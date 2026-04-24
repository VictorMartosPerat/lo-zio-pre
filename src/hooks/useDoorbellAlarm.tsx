import { useCallback, useRef } from "react";

/**
 * Doorbell-style alarm using Web Audio API. Loops every second for up to 60 seconds.
 * Two-tone (800Hz then 600Hz) to imitate a real doorbell.
 */
export const useDoorbellAlarm = () => {
  const ctxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<number | null>(null);

  const ensureContext = () => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctxRef.current = new AC();
    }
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume().catch(() => { /* ignore */ });
    }
    return ctxRef.current;
  };

  const ring = useCallback(() => {
    try {
      const ctx = ensureContext();
      const t = ctx.currentTime;
      const tone = (freq: number, start: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.4, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.3);
        osc.start(start);
        osc.stop(start + 0.3);
      };
      tone(800, t);
      tone(600, t + 0.15);
    } catch {
      /* ignore */
    }
  }, []);

  const stop = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    stop();
    ring(); // ring immediately
    let elapsed = 0;
    intervalRef.current = window.setInterval(() => {
      elapsed += 1;
      ring();
      if (elapsed >= 59) stop(); // ~60s total
    }, 1000);
  }, [ring, stop]);

  return { start, stop };
};
