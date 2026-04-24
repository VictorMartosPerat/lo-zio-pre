import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Statuses that trigger a customer email
const NOTIFIABLE_STATUSES = new Set(["confirmed", "cancelled"]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase env not configured");
    }

    // Called by a database webhook on orders UPDATE
    const payload = await req.json();
    const record = payload.record;
    const oldRecord = payload.old_record;

    if (!record) throw new Error("No record in payload");
    if (record.status === oldRecord?.status) {
      return new Response(JSON.stringify({ skipped: "no_status_change" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!NOTIFIABLE_STATUSES.has(record.status)) {
      return new Response(JSON.stringify({ skipped: "status_not_notifiable" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const toEmail = record.guest_email;
    if (!toEmail) throw new Error("No email on order");

    const shortId = String(record.id).slice(0, 8).toUpperCase();

    // Compute estimated ready time for confirmed orders
    let readyTime: string | undefined;
    const minutes = Number(record.estimated_time) || 45;
    if (record.status === "confirmed") {
      const acceptedAt = record.accepted_at
        ? new Date(record.accepted_at as string)
        : new Date();
      const ready = new Date(acceptedAt.getTime() + minutes * 60_000);
      readyTime = `${String(ready.getHours()).padStart(2, "0")}:${String(ready.getMinutes()).padStart(2, "0")}`;
    }

    const templateData = {
      guestName: record.guest_name,
      shortId,
      totalAmount: Number(record.total_amount) || 0,
      status: record.status,
      estimatedMinutes: minutes,
      readyTime,
      rejectionReason: record.rejection_reason ?? undefined,
      pickupStore: record.pickup_store ?? null,
      refunded:
        record.status === "cancelled" && record.payment_status === "refunded",
    };

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase.functions.invoke(
      "send-transactional-email",
      {
        body: {
          templateName: "order-status-update",
          recipientEmail: toEmail,
          idempotencyKey: `order-status-${record.id}-${record.status}`,
          templateData,
        },
      },
    );

    if (error) {
      console.error("send-transactional-email error", error);
      throw error;
    }

    console.log(
      `Queued status email to ${toEmail} for order ${record.id} (${record.status})`,
    );
    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in notify-order-status:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
