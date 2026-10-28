/** 24-point sparkline: accent line 1.5px, 16% fill, no axes. Decorative; numbers carry the meaning. */
export function Sparkline({ points, height = 32, className = "" }: { points: number[]; height?: number; className?: string }) {
  const w = 120;
  const max = Math.max(1, ...points);
  const step = points.length > 1 ? w / (points.length - 1) : w;
  const ys = points.map((p) => height - 2 - (p / max) * (height - 4));
  const line = ys.map((y, i) => `${i ? "L" : "M"}${(i * step).toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className={`w-full ${className}`} style={{ height }} aria-hidden>
      <path d={`${line} L${w},${height} L0,${height} Z`} fill="var(--color-accent)" fillOpacity={0.16} />
      <path d={line} fill="none" stroke="var(--color-accent)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
