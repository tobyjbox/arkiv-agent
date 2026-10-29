"use client";

import { useState } from "react";
import { formatCount } from "../../lib/format";

export type DayPoint = { day: string; writes: number; wallets: number; projects: number; newProjects: number };
const SERIES = { writes: "Writes", wallets: "Active wallets", projects: "Active projects", newProjects: "New projects" } as const;
type Series = keyof typeof SERIES;

/** Daily activity, one series at a time (design/05). Today is partial, so its point is drawn open. */
export function ActivityChart({ days, missingDays, firstDay }: { days: DayPoint[]; missingDays: number; firstDay: string }) {
  const [series, setSeries] = useState<Series>("writes");
  const total = days.length + missingDays;
  const values = days.map((d) => d[series]);
  const max = Math.max(1, ...values);
  const W = 600, H = 160, x = (i: number) => ((missingDays + i) / Math.max(1, total - 1)) * W, y = (v: number) => H - (v / max) * (H - 10);
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = values.length - 1;
  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Series" className="flex flex-wrap gap-1">
        {(Object.keys(SERIES) as Series[]).map((s) => (
          <button key={s} type="button" role="tab" aria-selected={s === series} onClick={() => setSeries(s)}
            className={`rounded-sm px-2.5 py-1 caption ${s === series ? "bg-raised text-text-primary" : "text-text-secondary hover:text-text-primary"}`}>{SERIES[s]}</button>
        ))}
      </div>
      <figure className="rounded-md border border-border-subtle bg-surface p-4">
        <svg viewBox={`0 0 ${W} ${H + 18}`} className="h-[200px] w-full" role="img" aria-label={`${SERIES[series]} per day`}>
          <defs><pattern id="before" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-border-default)" strokeWidth="2" /></pattern></defs>
          {missingDays > 0 && <rect x="0" y="0" width={x(0)} height={H} fill="url(#before)" />}
          {values.length > 1 && <path d={`${line} L${x(last)},${H} L${x(0)},${H} Z`} fill="color-mix(in srgb, var(--color-accent) 14%, transparent)" />}
          <path d={line} fill="none" stroke="var(--color-accent)" strokeWidth="1.5" />
          {last >= 0 && <circle cx={x(last)} cy={y(values[last]!)} r="3.5" fill="var(--color-canvas)" stroke="var(--color-accent)" strokeWidth="1.5"><title>{`${days[last]!.day} so far today: ${formatCount(values[last]!)}`}</title></circle>}
          {values.map((v, i) => i === last ? null : <circle key={i} cx={x(i)} cy={y(v)} r="6" fill="transparent"><title>{`${days[i]!.day}: ${formatCount(v)}`}</title></circle>)}
          {/* The hatched band is named below its left edge, clear of the max label and the line, and never clipped. */}
          {(missingDays > 0 || days.length > 0) && <text x="0" y={H + 14} className="fill-[var(--color-text-tertiary)] text-[10px]">{missingDays > 0 ? `Before Tiramisu (${firstDay})` : days[0]!.day}</text>}
          {days.length > 0 && <text x={W} y={H + 14} textAnchor="end" className="fill-[var(--color-text-tertiary)] text-[10px]">{days[last]!.day} (so far)</text>}
          <text x="4" y={y(max) + 12} className="fill-[var(--color-text-tertiary)] text-[10px]">{formatCount(max)}</text>
        </svg>
        <details className="mt-2 caption text-text-secondary">
          <summary className="cursor-pointer">Data table</summary>
          <table className="mt-2 w-full max-w-md text-left">
            <thead><tr className="text-text-tertiary"><th className="py-1 font-medium">Day (UTC)</th><th className="py-1 text-right font-medium">{SERIES[series]}</th></tr></thead>
            <tbody>{days.map((d, i) => <tr key={d.day}><td className="py-0.5 font-mono">{d.day}{i === last ? " (so far)" : ""}</td><td className="py-0.5 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>{formatCount(d[series])}</td></tr>)}</tbody>
          </table>
        </details>
      </figure>
    </div>
  );
}
