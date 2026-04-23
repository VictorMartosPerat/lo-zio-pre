import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN");
    const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID");
    const OWNER_WHATSAPP = Deno.env.get("OWNER_WHATSAPP");

    if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID || !OWNER_WHATSAPP) {
      throw new Error("Missing WhatsApp environment variables");
    }

    const payload = await req.json();
    // Database webhooks send { type, table, record, schema, old_record }
    const record = payload.record;

    if (!record) {
      throw new Error("No record found in webhook payload");
    }

    const name = record.guest_name || "Sin nombre";
    const phone = record.phone || "No proporcionado";
    const guests = record.guests || "2";
    const date = record.reservation_date || "No especificada";
    const time = record.reservation_time || "No especificada";
    const location = record.location || "No especificado";
    const notes = record.notes ? `\n📝 Notas: ${record.notes}` : "";

    const message =
      `🍕 *Nueva reserva en Lo Zio*\n\n` +
      `👤 Nombre: ${name}\n` +
      `📞 Teléfono: ${phone}\n` +
      `👥 Personas: ${guests}\n` +
      `📅 Fecha: ${date}\n` +
      `🕐 Hora: ${time}\n` +
      `📍 Local: ${location}${notes}`;

    // Clean phone number - remove spaces, dashes, ensure starts with country code
    const cleanPhone = OWNER_WHATSAPP.replace(/[\s\-()]/g, "");

    const whatsappResponse = await fetch(
      `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: cleanPhone,
          type: "text",
          text: { body: message },
        }),
      }
    );

    const result = await whatsappResponse.json();

    if (!whatsappResponse.ok) {
      console.error("WhatsApp API error:", JSON.stringify(result));
      throw new Error(`WhatsApp API error: ${result.error?.message || "Unknown"}`);
    }

    console.log("WhatsApp message sent successfully:", JSON.stringify(result));

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in notify-reservation:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
