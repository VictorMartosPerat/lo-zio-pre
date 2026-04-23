interface PullToRefreshIndicatorProps {
  pullDistance: number;
  refreshing: boolean;
  threshold?: number;
}

const PullToRefreshIndicator = ({
  pullDistance,
  refreshing,
  threshold = 80,
}: PullToRefreshIndicatorProps) => {
  const progress = Math.min(pullDistance / threshold, 1);
  const isReady = progress >= 1;
  const rotate = `rotate(${pullDistance * 2.5}deg)`;

  return (
    <div className="absolute inset-x-0 top-0 flex flex-col items-center justify-center bg-background"
      style={{ height: refreshing ? 72 : pullDistance }}
    >
      <div
        className="flex flex-col items-center gap-1.5"
        style={{ opacity: progress, transform: `scale(${0.4 + progress * 0.6})` }}
      >
        <div
          className={`relative ${refreshing ? "animate-spin" : ""} ${isReady && !refreshing ? "drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]" : ""}`}
          style={{ transform: refreshing ? undefined : rotate, transition: refreshing ? undefined : "transform 0.05s linear" }}
        >
          <img src="/Lozio_favicon-2.png" alt="" className={`w-10 h-10 object-contain transition-all duration-300 ${isReady ? "brightness-110" : "brightness-75"}`} />
          {isReady && !refreshing && (
            <span className="absolute inset-0 rounded-full animate-ping bg-primary/20 scale-125" />
          )}
        </div>
        <span className={`font-body text-[10px] uppercase tracking-widest font-bold transition-colors duration-300 ${isReady || refreshing ? "text-primary" : "text-muted-foreground"}`}>
          {refreshing ? "Actualizando…" : isReady ? "Suelta para actualizar" : "Tira para actualizar"}
        </span>
      </div>
    </div>
  );
};

export default PullToRefreshIndicator;
