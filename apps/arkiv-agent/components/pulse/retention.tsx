"use client";

import { Check, Minus, X } from "lucide-react";
import { useState } from "react";

type Marks = { d7: boolean | null; d14: boolean | null; d30: boolean | null };
export type CohortView = {
  id: string; label: string; source: string;
  projects: { project: string; marks: Marks }[];
  retention: Record<keyof Marks, { wrote: number; reached: number }>;
  /** Days until each window first closes for someone in the cohort, when none has. */
  opensIn: Record<keyof Marks, number | null>;
};

const WINDOW_LABEL = { d7: "D7", d14: "D14", d30: "D30" } as const;
const WINDOW_DAYS = { d7: "days 7–13", d14: "days 14–29", d30: "days 30–59" } as const;

/** Headline retention chart (design/05): share of a cohort still writing after day 7, 14 and 30. */
export function Retention({ cohorts, hasEvents }: { cohorts: CohortView[]; hasEvents: boolean }) {
  // Open on the cohort with the most closed D7 windows: the most telling one.
  const [id, setId] = useState(() => [...cohorts].sort((x, y) => y.retention.d7.reached - x.retention.d7.reached)[0]?.id ?? "");
  const c = cohorts.find((x) => x.id === id) ?? cohorts[0];
  if (!c) return <p className="text-text-secondary">No projects with a project label have written yet.</p>;
  const keys = Object.keys(WINDOW_LABEL) as (keyof Marks)[];
  const d7 = c.retention.d7;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 caption">
        <label className="flex items-center gap-2 text-text-tertiary">Cohort
          <select value={c.id} onChange={(e) => setId(e.target.value)} title={`Source: ${c.source}`}
            className="h-7 max-w-[min(360px,70vw)] rounded-sm border border-border-default bg-surface px-2 text-text-primary">
            {cohorts.map((x) => <option key={x.id} value={x.id}>{x.label} ({x.projects.length})</option>)}
          </select>
        </label>
        {!hasEvents && <span className="text-text-tertiary">No hackathon cohorts yet: they are added from public event lists (packages/pulse/src/event-cohorts.json).</span>}
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <figure className="rounded-md border border-border-subtle bg-surface p-4 lg:col-span-7">
          <figcaption className="caption text-text-secondary">Still writing after their first week, fortnight and month</figcaption>
          <svg viewBox="0 0 300 150" className="mt-2 h-[180px] w-full" role="img" aria-label="Retention by window">
            <defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-border-control)" strokeWidth="2" /></pattern></defs>
            {keys.map((k, i) => {
              const r = c.retention[k];
              const share = r.reached ? r.wrote / r.reached : 0;
              const x = 30 + i * 90;
              const h = r.reached ? Math.max(2, share * 110) : 110;
              return (
                <g key={k}>
                  {r.reached ? <rect x={x} y={125 - h} width="60" height={h} rx="3" fill="var(--color-accent)" />
                    : <rect x={x} y={15} width="60" height="110" rx="3" fill="url(#hatch)" stroke="var(--color-border-default)" />}
                  <text x={x + 30} y={r.reached ? 118 - h : 70} textAnchor="middle" className="fill-[var(--color-text-primary)] text-[11px]" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {r.reached ? `${Math.round(share * 100)}%` : c.opensIn[k] !== null ? `in ${c.opensIn[k]} d` : "—"}
                  </text>
                  <text x={x + 30} y={142} textAnchor="middle" className="fill-[var(--color-text-tertiary)] text-[11px]">{WINDOW_LABEL[k]}</text>
                </g>
              );
            })}
          </svg>
          <p className="caption text-text-secondary">
            {d7.reached ? `${d7.wrote} of ${d7.reached} projects wrote again in ${WINDOW_DAYS.d7} after their first write (${Math.round((d7.wrote / d7.reached) * 100)}%).` : "No project in this cohort has reached day 13 yet."}
            {" "}Counts only projects whose window has closed. Source: {c.source}.
          </p>
        </figure>
        <div className="rounded-md border border-border-subtle bg-surface lg:col-span-5">
          <p className="border-b border-border-subtle px-4 py-2 caption text-text-secondary">Projects in cohort ({c.projects.length})</p>
          <ul className="max-h-[260px] divide-y divide-border-subtle overflow-auto">
            {c.projects.map((p) => (
              <li key={p.project} className="flex items-center justify-between gap-2 px-4 py-1.5">
                <a href={`/catalogue?q=${encodeURIComponent(p.project)}`} className="truncate font-mono text-[13px] hover:underline">{p.project}</a>
                <span className="flex shrink-0 gap-2 caption">
                  {keys.map((k) => (
                    <span key={k} className="flex items-center gap-0.5" title={`${WINDOW_LABEL[k]} (${WINDOW_DAYS[k]}): ${p.marks[k] === null ? "window not reached" : p.marks[k] ? "wrote" : "did not write"}`}>
                      <span className="text-text-tertiary">{WINDOW_LABEL[k]}</span>
                      {p.marks[k] === null ? <Minus size={12} className="text-text-disabled" aria-label="not reached" /> : p.marks[k] ? <Check size={12} className="text-live" aria-label="wrote" /> : <X size={12} className="text-text-tertiary" aria-label="did not write" />}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
