import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const VAPID_PUBLIC_KEY =
  'BFy3Ru15Qj70TU4JK3polKuevD0-qQp6bdOYjd8DgMQ0nL1gXVnS1m10tqbujXZ1k-RrEidt4ug9ggfXUqQTdBs';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export type PushStatus =
  | 'unsupported'
  | 'denied'
  | 'granted-subscribed'
  | 'granted-unsubscribed'
  | 'default';

async function persistSubscription(sub: PushSubscription, userId: string) {
  const json = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
    },
    { onConflict: 'endpoint' },
  );

  if (!error) {
    console.log('[Push] Subscription saved/updated in DB ✓');
    return true;
  }

  console.error('[Push] Failed to save subscription:', error);
  return false;
}

export const usePushSubscription = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<PushStatus>('default');
  const [busy, setBusy] = useState(false);

  const [supported] = useState(
    () =>
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window,
  );

  const syncExistingSubscription = useCallback(async () => {
    if (!user || !supported || Notification.permission !== 'granted') return false;

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return false;

      const ok = await persistSubscription(sub, user.id);
      if (ok) console.log('[Push] Existing subscription synced ✓');
      return ok;
    } catch (err) {
      console.error('[Push] syncExistingSubscription error:', err);
      return false;
    }
  }, [supported, user]);

  const refreshStatus = useCallback(async () => {
    if (!supported) {
      setStatus('unsupported');
      return;
    }

    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }

    if (Notification.permission === 'default') {
      setStatus('default');
      return;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();

      if (!sub) {
        setStatus('granted-unsubscribed');
        return;
      }

      setStatus('granted-subscribed');
      void syncExistingSubscription();
    } catch {
      setStatus('granted-unsubscribed');
    }
  }, [supported, syncExistingSubscription]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus, user]);

  const enablePush = useCallback(async () => {
    if (!user) {
      console.warn('[Push] No user logged in');
      return false;
    }

    if (!supported) {
      console.warn('[Push] Browser does not support push');
      setStatus('unsupported');
      return false;
    }

    setBusy(true);
    try {
      console.log('[Push] Requesting permission...');
      const permission = await Notification.requestPermission();
      console.log('[Push] Permission:', permission);

      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'default');
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      console.log('[Push] SW ready, scope:', registration.scope);

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        console.log('[Push] Creating new subscription...');
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        });
      }

      console.log('[Push] Subscription endpoint:', subscription.endpoint);

      const ok = await persistSubscription(subscription, user.id);
      if (!ok) return false;

      setStatus('granted-subscribed');
      return true;
    } catch (err) {
      console.error('[Push] enablePush error:', err);
      return false;
    } finally {
      setBusy(false);
    }
  }, [supported, user]);

  const disablePush = useCallback(async () => {
    if (!supported) return false;

    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus('granted-unsubscribed');
      return true;
    } catch (err) {
      console.error('[Push] disablePush error:', err);
      return false;
    } finally {
      setBusy(false);
    }
  }, [supported]);

  return { status, busy, supported, enablePush, disablePush, refreshStatus, syncExistingSubscription };
};
