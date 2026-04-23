import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
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
    const { orderId } = await req.json();
    if (!orderId) throw new Error("orderId is required");

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) throw new Error("Stripe secret key not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, payment_status, stripe_payment_intent_id, total_amount")
      .eq("id", orderId)
      .single();

    if (orderError || !order) throw new Error("Order not found");
    if (order.payment_status !== "paid") throw new Error("Order is not paid");
    if (!order.stripe_payment_intent_id) throw new Error("No payment intent found for this order");

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

    // Issue full refund
    const refund = await stripe.refunds.create({
      payment_intent: order.stripe_payment_intent_id,
    });

    // Update order payment status
    await supabase
      .from("orders")
      .update({ payment_status: "refunded" })
      .eq("id", orderId);

    return new Response(
      JSON.stringify({ success: true, refundId: refund.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in refund-order:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
