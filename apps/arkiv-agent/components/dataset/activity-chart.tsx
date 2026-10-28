"use client";

import { useState } from "react";
import { formatCount } from "../../lib/format";

/** Writes per hour (accent) with expiries as a muted second series; a sentence states the gist. */
export function ActivityChart({ writes, expiries }: { writes: number[]; expiries: number[] }) {
  const [range, setRange] = useState<24 | 168>(168);
  const w = writes.slice(-range);
  const x = expiries.slice(-range);
  const total = w.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...w, ...x);
  const width = 800, height = 160;
  const path = (s: number[], isArea: boolean) => {
    const step = width / Math.max(1, s.length - 1);
    const line = s.map((v, i) => `${i ? "L" : "M"}${(i * step).toFixed(1)},${(height - 4 - (v / max) * (height - 12)).toFixed(1)}`).join(" ");
    return isArea ? `${line} L${width},${height} L0,${height} Z` : line;
  };
  return (
    <section aria-labelledby="activity" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 id="activity" className="text-[20px] font-semibold">Activity</h2>
        <div role="group" aria-label="Range" className="flex rounded-sm border border-border-default p-0.5">
          {([24, 168] as const).map((r) => (
            <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}
              className={`rounded-sm px-2.5 py-1 caption ${range === r ? "bg-raised text-text-primary" : "text-text-secondary"}`}>{r === 24 ? "24h" : "7d"}</button>
          ))}
        </div>
      </div>
      <p className="text-text-secondary">
        {total ? `About ${formatCount(Math.round(total / range))} writes per hour over the last ${range === 24 ? "24 hours" : "7 days"} (${formatCount(total)} in all).` : `No writes in the last ${range === 24 ? "24 hours" : "7 days"}.`}
        {" "}<span className="text-text-tertiary">ArkivAgent decodes 7 days of history, so longer ranges are not shown.</span>
      </p>
      <div className="rounded-md bg-surface p-4">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-40 w-full" role="img" aria-label={`Writes per hour, ${range === 24 ? "24 hours" : "7 days"}; expiries muted.`}>
          {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={0} x2={width} y1={height * f} y2={height * f} stroke="var(--color-border-subtle)" />)}
          <path d={path(x, false)} fill="none" stroke="var(--color-text-tertiary)" strokeWidth={1.5} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          <path d={path(w, true)} fill="var(--color-accent)" fillOpacity={0.16} />
          <path d={path(w, false)} fill="none" stroke="var(--color-accent)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="mt-2 flex gap-4 caption text-text-tertiary">
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-accent" />writes</span>
          <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t border-dashed border-text-tertiary" />expiries</span>
        </div>
      </div>
    </section>
  );
}
