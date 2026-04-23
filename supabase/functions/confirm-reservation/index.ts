import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reservation_id } = await req.json();
    if (!reservation_id) throw new Error("reservation_id is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Fetch reservation
    const { data: reservation, error: fetchError } = await supabase
      .from("reservations")
      .select("*")
      .eq("id", reservation_id)
      .single();

    if (fetchError || !reservation) {
      throw new Error("Reservation not found");
    }

    // 2. Update status to confirmed
    const { error: updateError } = await supabase
      .from("reservations")
      .update({ status: "confirmed" })
      .eq("id", reservation_id);

    if (updateError) throw new Error(`Update failed: ${updateError.message}`);

    // 3. Send WhatsApp template message to customer
    const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN");
    const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID");

    if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
      throw new Error("Missing WhatsApp environment variables");
    }

    // Format date nicely (YYYY-MM-DD -> DD/MM/YYYY)
    const dateParts = reservation.reservation_date.split("-");
    const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;

    // Format time (HH:MM:SS -> HH:MM)
    const formattedTime = reservation.reservation_time.substring(0, 5);

    const customerPhone = reservation.phone.replace(/[\s\-()]/g, "");

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
          to: customerPhone,
          type: "template",
          template: {
            name: "reserva_confirmada",
            language: { code: "es" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: formattedDate },
                  { type: "text", text: formattedTime },
                  { type: "text", text: reservation.guests },
                ],
              },
            ],
          },
        }),
      }
    );

    const whatsappResult = await whatsappResponse.json();

    if (!whatsappResponse.ok) {
      console.error("WhatsApp API error:", JSON.stringify(whatsappResult));
      throw new Error(`WhatsApp error: ${whatsappResult.error?.message || "Unknown"}`);
    }

    console.log("WhatsApp confirmation sent:", JSON.stringify(whatsappResult));

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in confirm-reservation:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
