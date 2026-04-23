import { useEffect, useRef, useState, useCallback } from "react";

export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const THRESHOLD = 80;
  const MAX_PULL = 120;

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!pulling.current || refreshing) return;
      const diff = e.touches[0].clientY - startY.current;
      if (diff > 0) {
        e.preventDefault();
        setPullDistance(Math.min(diff * 0.5, MAX_PULL));
      } else {
        pulling.current = false;
        setPullDistance(0);
      }
    },
    [refreshing],
  );

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;
    setPullDistance((d) => {
      if (d >= THRESHOLD) {
        setRefreshing(true);
        onRefresh().finally(() => {
          setRefreshing(false);
          setPullDistance(0);
        });
        return THRESHOLD;
      }
      return 0;
    });
  }, [onRefresh]);

  useEffect(() => {
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);
    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const translateY = refreshing ? 72 : pullDistance;
  const isAnimating = !pulling.current;

  return { containerRef, pullDistance, refreshing, translateY, isAnimating };
}
