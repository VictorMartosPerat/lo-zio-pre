import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Verifies a Stripe payment with the Stripe API (the source of truth) and
// marks the corresponding order as paid using the service role. Replaces the
// previous client-side UPDATE which depended on an over-permissive RLS policy
// and let any caller mark any order as paid without paying.
//
// Auth model: callable by anon (verify_jwt = false in config.toml). Security
// comes from Stripe verification — the caller must supply a paymentIntentId
// whose metadata.orderId matches the supplied orderId, which means Stripe
// recorded a payment for exactly this order. Forging that requires actually
// paying.

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
    const { orderId, paymentIntentId } = await req.json();
    if (!orderId || !paymentIntentId) {
      return new Response(
        JSON.stringify({ error: "orderId and paymentIntentId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecret) throw new Error("Stripe not configured");

    const stripe = new Stripe(stripeSecret, { apiVersion: "2023-10-16" });
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (pi.metadata?.orderId !== orderId) {
      console.warn("Payment intent metadata mismatch", {
        orderId,
        piId: paymentIntentId,
        piMetaOrderId: pi.metadata?.orderId,
      });
      return new Response(
        JSON.stringify({ error: "Payment intent does not match order" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (pi.status === "succeeded") {
      const { data: existing } = await supabase
        .from("orders")
        .select("pickup_store, assigned_to")
        .eq("id", orderId)
        .single();
      const fallback: "tarragona" | "arrabassada" =
        existing?.pickup_store === "arrabassada" ? "arrabassada" : "tarragona";

      const { data: updated, error: updateError } = await supabase
        .from("orders")
        .update({
          payment_status: "paid",
          stripe_payment_intent_id: paymentIntentId,
          assigned_to: existing?.assigned_to ?? fallback,
        })
        .eq("id", orderId)
        .select("*")
        .single();

      if (updateError) {
        console.error("Order update failed:", updateError);
        throw new Error("Failed to mark order as paid");
      }

      const { data: items } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId);

      return new Response(
        JSON.stringify({ success: true, order: updated, items: items ?? [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Definitively-failed states — mark order so admin can clean up.
    if (pi.status === "canceled" || pi.status === "requires_payment_method") {
      await supabase
        .from("orders")
        .update({ payment_status: "failed" })
        .eq("id", orderId);
      return new Response(
        JSON.stringify({ success: false, error: "payment_failed", status: pi.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Intermediate states (processing, requires_action, etc.) — don't update.
    return new Response(
      JSON.stringify({ success: false, status: pi.status }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error in confirm-stripe-payment:", error instanceof Error ? error.message : error);
    return new Response(
      JSON.stringify({ error: "Payment confirmation failed." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
