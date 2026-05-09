import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const isTest = body.test === true;

    // Test path requires a verified admin JWT — DB webhook calls never set test:true
    if (isTest) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const supabaseCheck = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: roleData } = await supabaseCheck
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!roleData) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Supabase DB webhook sends { type, table, schema, record, old_record }
    const record = body.record ?? body;

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidSubject = Deno.env.get("VAPID_SUBJECT")!;

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (!adminRoles?.length) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_admins" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminIds = adminRoles.map((r: { user_id: string }) => r.user_id);
    // Test sends only to the requesting admin, not all admins
    const targetIds = isTest ? [adminIds[0]] : adminIds;

    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", targetIds);

    console.log(`[push] admins=${adminIds.length} subs=${subscriptions?.length ?? 0} test=${isTest}`);

    if (!subscriptions?.length) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_subscriptions", admins: adminIds.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [y, m, d] = (record.reservation_date ?? "").split("-");
    const formattedDate = d ? `${d}/${m}/${y}` : "";
    const formattedTime = (record.reservation_time ?? "").substring(0, 5);

    const payload = JSON.stringify(
      isTest
        ? {
            title: "🔔 Notificación de prueba",
            body: "Si ves esto, las notificaciones funcionan correctamente ✅",
            icon: "/pwa-192x192.png",
            badge: "/pwa-192x192.png",
            url: "/admin",
          }
        : {
            title: "🍕 Nueva reserva en Lo Zio",
            body: `👤 ${record.guest_name ?? "Cliente"} — 👥 ${record.guests ?? "2"}p\n📅 ${formattedDate} a las ${formattedTime}`,
            icon: "/pwa-192x192.png",
            badge: "/pwa-192x192.png",
            url: "/admin",
          },
    );

    const results = await Promise.allSettled(
      subscriptions.map(async (sub: { endpoint: string; p256dh: string; auth: string }) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
        } catch (err: any) {
          if (err?.statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          }
          throw err;
        }
      }),
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;

    return new Response(JSON.stringify({ sent, total: subscriptions.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-push-notification error:", err);
    return new Response(JSON.stringify({ error: "Notification failed." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
