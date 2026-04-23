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
    const { location, guest_name, phone, reservation_date, reservation_time, guests, notes, user_id, is_admin } =
      await req.json();

    if (!location || !guest_name || !phone || !reservation_date || !reservation_time || !guests) {
      throw new Error("Missing required fields");
    }

    const guestsNum = parseInt(guests) || 2;
    if (!is_admin && (guestsNum < 1 || guestsNum > 10)) {
      throw new Error("El número de comensales debe ser entre 1 y 10 para reservas online.");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find available tables using the multi-table DB function
    const { data: tableIds, error: rpcError } = await supabase.rpc("find_available_tables_multi", {
      _location: location,
      _date: reservation_date,
      _time: reservation_time,
      _guests: guestsNum,
    });

    if (rpcError) {
      console.error("RPC error:", rpcError);
      throw new Error("Error checking table availability");
    }

    if (!tableIds || tableIds.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "no_tables",
          message:
            "Lo sentimos, no hay mesas disponibles para ese horario. Por favor elige otro horario o llámanos directamente.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get table names for the confirmation message
    const { data: tablesData } = await supabase.from("tables").select("id, name").in("id", tableIds);
    const tableNames = tablesData?.map((t) => t.name).join(" + ") || "asignada";

    // Create a single reservation with all assigned tables
    const reservationInsert = {
      location,
      guest_name,
      email: "online@reserva.lozio",
      phone,
      reservation_date,
      reservation_time,
      guests: String(guestsNum),
      notes: tableIds.length > 1 ? `${notes || ""} [Grupo ${guestsNum}p: ${tableNames}]`.trim() : (notes || null),
      user_id: user_id || null,
      table_id: tableIds[0],
      table_ids: tableIds,
      status: "confirmed",
    };

    const { data: reservations, error: insertError } = await supabase
      .from("reservations")
      .insert([reservationInsert])
      .select();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error("Error creating reservation");
    }

    // Notify owner via WhatsApp (non-blocking)
    try {
      const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN");
      const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID");
      const OWNER_WHATSAPP = Deno.env.get("OWNER_WHATSAPP");

      if (WHATSAPP_TOKEN && WHATSAPP_PHONE_ID && OWNER_WHATSAPP) {
        const dateParts = reservation_date.split("-");
        const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
        const formattedTime = reservation_time.substring(0, 5);
        const cleanPhone = OWNER_WHATSAPP.replace(/[\s\-()]/g, "");

        const message =
          `🍕 *Nueva reserva CONFIRMADA en Lo Zio*\n\n` +
          `👤 Nombre: ${guest_name}\n` +
          `📞 Teléfono: ${phone}\n` +
          `👥 Personas: ${guestsNum}\n` +
          `📅 Fecha: ${formattedDate}\n` +
          `🕐 Hora: ${formattedTime}\n` +
          `🪑 Mesa${tableIds.length > 1 ? "s" : ""}: ${tableNames}\n` +
          `📍 Local: ${location}${notes ? `\n📝 Notas: ${notes}` : ""}`;

        await fetch(`https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_ID}/messages`, {
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
        });
      }
    } catch (whatsappError) {
      console.error("WhatsApp notification failed (non-blocking):", whatsappError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        reservation_id: reservations?.[0]?.id,
        table_name: tableNames,
        message: `¡Reserva confirmada! Te esperamos el ${reservation_date} a las ${reservation_time.substring(0, 5)} en ${tableIds.length > 1 ? "las mesas" : "la"} ${tableNames}.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in auto-assign-reservation:", msg);
    return new Response(JSON.stringify({ success: false, error: "server_error", message: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
