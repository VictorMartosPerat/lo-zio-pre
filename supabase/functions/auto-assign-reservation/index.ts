import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_LOCATIONS = new Set(["tarragona", "arrabassada", "rincon"]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { location, guest_name, phone, reservation_date, reservation_time, guests, notes, user_id } =
      await req.json();

    if (!location || !guest_name || !phone || !reservation_date || !reservation_time || !guests) {
      throw new Error("Missing required fields");
    }

    // location must be a known store slug — never trust as URL or path
    if (!ALLOWED_LOCATIONS.has(location)) {
      throw new Error("Invalid location");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Derive admin status from the verified JWT — never from the request body
    let callerIsAdmin = false;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const supabaseUser = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user } } = await supabaseUser.auth.getUser();
      if (user) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();
        callerIsAdmin = !!roleData;
      }
    }

    const guestsNum = parseInt(guests) || 2;
    if (!callerIsAdmin && (guestsNum < 1 || guestsNum > 10)) {
      throw new Error("El número de comensales debe ser entre 1 y 10 para reservas online.");
    }

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
    console.error("Error in auto-assign-reservation:", error instanceof Error ? error.message : error);
    return new Response(JSON.stringify({ success: false, error: "server_error", message: "Reservation failed. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
