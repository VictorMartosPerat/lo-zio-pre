import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Only send emails for these statuses
const STATUS_INFO: Record<string, { label: string; emoji: string; message: (r: Record<string, unknown>) => string }> = {
  confirmed: {
    label: "Aceptado",
    emoji: "✅",
    message: (r) => {
      const minutes = Number(r.estimated_time) || 45;
      const acceptedAt = r.accepted_at ? new Date(r.accepted_at as string) : new Date();
      const ready = new Date(acceptedAt.getTime() + minutes * 60_000);
      const hh = String(ready.getHours()).padStart(2, "0");
      const mm = String(ready.getMinutes()).padStart(2, "0");
      return `¡Tu pedido ha sido aceptado! Tiempo estimado: <strong>${minutes} minutos</strong>. Hora estimada: <strong>${hh}:${mm}</strong>.`;
    },
  },
  cancelled: {
    label: "Rechazado",
    emoji: "❌",
    message: (r) => (r.rejection_reason as string) ||
      "Lo sentimos, en este momento no podemos aceptar tu pedido. Llámanos directamente al local o inténtalo de nuevo.",
  },
};

const STORE_NAMES: Record<string, string> = {
  tarragona: "Lo Zio Tarragona — Carrer Reding 32, Tarragona · +34 687 605 647",
  arrabassada: "Lo Zio Arrabassada — Carrer Joan Fuster 28, Tarragona · +34 682 239 035",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    // This function is called by a database webhook on orders UPDATE
    const payload = await req.json();
    const record = payload.record;
    const oldRecord = payload.old_record;

    if (!record) throw new Error("No record in payload");

    // Only send email if status actually changed
    if (record.status === oldRecord?.status) {
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only send for statuses that matter to the customer
    const statusInfo = STATUS_INFO[record.status];
    if (!statusInfo) {
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only send to guests (users without account) — logged-in users see it in the app
    // We send to everyone actually, since it's good UX regardless
    const toEmail = record.guest_email;
    if (!toEmail) throw new Error("No email on order");

    const shortId = record.id.slice(0, 8).toUpperCase();
    const storeLine = record.pickup_store
      ? `<p style="color:#6b7280;font-size:14px;margin:4px 0;">📍 ${STORE_NAMES[record.pickup_store] ?? record.pickup_store}</p>`
      : "";

    const refundLine = record.status === "cancelled" && record.payment_status === "refunded"
      ? `<div style="background:#f3e8ff;border:1px solid #d8b4fe;border-radius:8px;padding:12px 16px;margin:16px 0;">
          <p style="color:#7e22ce;font-size:14px;margin:0;">💳 Se ha procesado un <strong>reembolso automático</strong> al método de pago original. Lo recibirás en 5–10 días hábiles.</p>
         </div>`
      : "";

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;background:#f9fafb;margin:0;padding:0;">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#0f766e;padding:28px 32px;text-align:center;">
      <p style="color:#99f6e4;font-size:13px;letter-spacing:2px;text-transform:uppercase;margin:0 0 6px;">Lo Zio Pizzería</p>
      <h1 style="color:#fff;font-size:24px;margin:0;">${statusInfo.emoji} Tu pedido ${statusInfo.label.toLowerCase()}</h1>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px;">
      <p style="color:#111827;font-size:16px;margin:0 0 4px;">Hola, <strong>${record.guest_name}</strong></p>
      <p style="color:#4b5563;font-size:15px;margin:4px 0 20px;">${statusInfo.message(record)}</p>

      <!-- Order details -->
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin-bottom:16px;">
        <p style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Pedido #${shortId}</p>
        <p style="color:#111827;font-size:18px;font-weight:bold;margin:0 0 4px;">${Number(record.total_amount).toFixed(2)} €</p>
        ${storeLine}
      </div>

      ${refundLine}

      <p style="color:#9ca3af;font-size:13px;text-align:center;margin-top:24px;">
        ¿Tienes alguna duda? Llámanos directamente al local.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f3f4f6;padding:16px 32px;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">Lo Zio Pizzería · Tarragona</p>
    </div>
  </div>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Lo Zio <pedidos@lozio.es>",
        to: [toEmail],
        subject: `${statusInfo.emoji} Tu pedido #${shortId} — ${statusInfo.label}`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend error: ${err}`);
    }

    console.log(`Email sent to ${toEmail} for order ${record.id} — status: ${record.status}`);

    return new Response(JSON.stringify({ success: true }), {
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
