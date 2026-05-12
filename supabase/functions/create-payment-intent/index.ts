import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function computeDiscountAmount(type: string, value: number, subtotal: number): number {
  let amt = 0;
  if (type === "percentage") amt = Math.round((subtotal * value) / 100 * 100) / 100;
  else if (type === "fixed_amount") amt = value;
  if (amt > subtotal) amt = subtotal;
  if (amt < 0) amt = 0;
  return amt;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId, currency = "eur" } = await req.json();

    if (!orderId) {
      throw new Error("orderId is required");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Calculate subtotal server-side from order_items — never trust client amount
    const { data: orderItems, error: itemsError } = await supabase
      .from("order_items")
      .select("total_price")
      .eq("order_id", orderId);

    if (itemsError || !orderItems || orderItems.length === 0) {
      throw new Error("Order items not found");
    }

    const subtotal = orderItems.reduce(
      (sum: number, item: { total_price: number }) => sum + Number(item.total_price),
      0,
    );

    if (subtotal <= 0) {
      throw new Error("Invalid order amount");
    }

    // Re-validate any attached discount independently (R-DISC-005). Discount may
    // have expired or been deactivated between order INSERT and payment.
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("discount_id, discount_amount, user_id")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      throw new Error("Order not found");
    }

    let appliedDiscount = 0;
    if (order.discount_id) {
      const { data: d, error: dErr } = await supabase
        .from("discounts")
        .select("id, is_active, expires_at, discount_type, discount_value, min_order_amount")
        .eq("id", order.discount_id)
        .single();
      if (dErr || !d) {
        return new Response(
          JSON.stringify({
            error: "discount_invalid",
            message: "El descuento ya no es válido. Recarga la página.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (!d.is_active || new Date(d.expires_at).getTime() <= Date.now()) {
        return new Response(
          JSON.stringify({
            error: "discount_expired",
            message: "El descuento ya no es válido. Recarga la página.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (d.min_order_amount != null && subtotal < Number(d.min_order_amount)) {
        return new Response(
          JSON.stringify({
            error: "discount_min_not_met",
            message: "El subtotal ya no alcanza el mínimo del descuento.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      appliedDiscount = computeDiscountAmount(
        d.discount_type,
        Number(d.discount_value),
        subtotal,
      );
    }

    const finalAmount = Math.max(0, subtotal - appliedDiscount);
    if (finalAmount <= 0) {
      throw new Error("Order total must be greater than zero");
    }

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new Error("Stripe not configured");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    const amountInCents = Math.round(finalAmount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency,
      metadata: { orderId },
      automatic_payment_methods: { enabled: true },
    });

    return new Response(
      JSON.stringify({ clientSecret: paymentIntent.client_secret }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error in create-payment-intent:", error instanceof Error ? error.message : error);
    return new Response(
      JSON.stringify({ error: "Payment processing failed. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
