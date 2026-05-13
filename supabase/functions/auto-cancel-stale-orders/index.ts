// Auto-cancels pending orders 3h after their effective time
// (scheduled_for if set, otherwise created_at). verify_jwt = false:
// invoked exclusively by pg_cron via net.http_post with service-role bearer.
//
// ASSUMPTION (2026-05-13): we trust the frontend (Checkout + getScheduleStatus
// in src/lib/storeHours.ts) to block ASAP orders when no store is open. So
// effective_time = created_at is safe for ASAP. If that guard ever fails,
// an out-of-hours ASAP order will be auto-cancelled 3h after creation —
// possibly before the store ever opens. Revisit by computing
// max(created_at, next_store_opening) per pickup_store/assigned_to here.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // effective_time = COALESCE(scheduled_for, created_at)
  // cancel when now() - effective_time > 3 hours
  const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

  const { data: stale, error: selErr } = await supabase
    .from('orders')
    .select('id, scheduled_for, created_at, payment_method, payment_status, stripe_payment_intent_id')
    .eq('status', 'pending');

  if (selErr) {
    console.error('select error', selErr);
    return new Response(JSON.stringify({ error: selErr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const toCancel = (stale ?? []).filter((o) => {
    const eff = o.scheduled_for ?? o.created_at;
    return eff && eff < cutoff;
  });

  let cancelled = 0;
  for (const o of toCancel) {
    const { error: upErr } = await supabase
      .from('orders')
      .update({ status: 'cancelled', rejection_reason: 'auto_cancelled_timeout' })
      .eq('id', o.id)
      .eq('status', 'pending'); // guard against race
    if (upErr) {
      console.error('cancel failed', o.id, upErr);
      continue;
    }
    cancelled++;

    // Refund if paid by card
    if (o.payment_method === 'card' && o.payment_status === 'paid' && o.stripe_payment_intent_id) {
      try {
        await supabase.functions.invoke('refund-order', { body: { order_id: o.id } });
      } catch (e) {
        console.error('refund invoke failed', o.id, e);
      }
    }
  }

  return new Response(JSON.stringify({ scanned: stale?.length ?? 0, cancelled }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
