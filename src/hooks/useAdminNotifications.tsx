import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { toast } from 'sonner';

export const useAdminNotifications = () => {
  const { isAdmin } = useIsAdmin();
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Unlock Web Audio context on first user interaction (browser autoplay policy)
  useEffect(() => {
    if (!isAdmin) return;

    const unlock = () => {
      if (audioCtxRef.current) return;
      try {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AC();
      } catch { /* ignore */ }
    };

    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('touchstart', unlock, { once: true });

    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
    };
  }, [isAdmin]);

  // Request browser notification permission once admin is confirmed
  useEffect(() => {
    if (!isAdmin) return;
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [isAdmin]);

  // Two-tone ding using Web Audio API — no external file, no CDN dependency
  const playSound = useCallback(() => {
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = audioCtxRef.current ?? new AC();
      if (!audioCtxRef.current) audioCtxRef.current = ctx;
      if (ctx.state === 'suspended') ctx.resume();

      const ding = (freq: number, start: number, duration: number, vol: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(vol, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        osc.start(start);
        osc.stop(start + duration);
      };

      const t = ctx.currentTime;
      ding(880, t, 0.5, 0.35);        // A5
      ding(1108, t + 0.2, 0.5, 0.25); // C#6
    } catch { /* ignore */ }
  }, []);

  const showNotification = useCallback((guestName: string, guests: string, time: string, date: string) => {
    const [y, m, d] = date.split('-');
    const formattedDate = `${d}/${m}/${y}`;
    const formattedTime = time.substring(0, 5);
    const body = `👤 ${guestName} — 👥 ${guests}p\n📅 ${formattedDate} a las ${formattedTime}`;

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('🍕 Nueva reserva en Lo Zio', {
        body,
        icon: '/pwa-192x192.png',
        // Unique tag per reservation so multiple notifications don't replace each other
        tag: `reservation-${Date.now()}`,
      });
    }

    toast.info('🍕 Nueva reserva', { description: body, duration: 8000 });
  }, []);

  // Subscribe to realtime as soon as isAdmin is true — no loading gate
  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel('admin-reservation-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reservations' },
        (payload) => {
          const r = payload.new as Record<string, string>;
          playSound();
          showNotification(
            r.guest_name || 'Cliente',
            r.guests || '2',
            r.reservation_time || '',
            r.reservation_date || '',
          );
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, playSound, showNotification]);
};
