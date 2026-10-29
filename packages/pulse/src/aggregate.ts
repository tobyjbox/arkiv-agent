// Pure aggregation for the ecosystem pulse: (day, wallet, writes) rows in, series, totals, project
// activity and retention cohorts out. Days are UTC day numbers (ms since epoch / 86,400,000).

export const PERIODS = [7, 30, 90] as const;
export type Period = (typeof PERIODS)[number];

/** Retention windows, in days after a project's (or an event's) day 0: D7 = days 7–13, and so on. */
export const WINDOWS = { d7: [7, 13], d14: [14, 29], d30: [30, 59] } as const;
export type WindowKey = keyof typeof WINDOWS;

export type ActivityRow = { day: number; wallet: string; writes: number };
export type PulseDay = { day: number; writes: number; wallets: number; projects: number; newProjects: number };
export type Totals = { writes: number; wallets: number; projects: number; newProjects: number };
export type ProjectActivity = { project: string; isLabel: boolean; writes: number; activeDays: number; lastDay: number; daily: number[] };
/** true: wrote in the window; false: the window closed with no writes; null: the window hasn't closed and nothing yet. */
export type Marks = Record<WindowKey, boolean | null>;
export type Cohort = {
  id: string;
  label: string;
  /** Day 0 for event cohorts; first day of the start week for "started in week" cohorts. */
  startDay: number;
  source: string;
  projects: { project: string; firstDay: number; day0: number; marks: Marks }[];
  retention: Record<WindowKey, { wrote: number; reached: number }>;
};
/** A hackathon or event cohort: named projects and the event day (from a public, cited source). */
export type EventCohort = { id: string; label: string; day: string; source: string; projects: string[] };

export type PulseInput = {
  rows: ActivityRow[];
  /** Wallet (lowercase) to project label; wallets without one count as their own project. */
  projectOf: ReadonlyMap<string, string>;
  /** Lowercase wallets to leave out (load generators), unless `includeLoad`. */
  loadWallets: ReadonlySet<string>;
  includeLoad: boolean;
  period: Period;
  today: number;
  firstDay: number;
  events?: EventCohort[];
};

export type PulseData = {
  period: Period;
  today: number;
  firstDay: number;
  /** The period's days from `firstDay` on (days before the chain started are not drawn). */
  days: PulseDay[];
  /** Days of the period before the chain started (shown as "before Tiramisu"). */
  missingDays: number;
  totals: Totals;
  /** The previous period of the same length, or null when it is entirely before the chain started. */
  previous: Totals | null;
  projects: ProjectActivity[];
  cohorts: Cohort[];
  events: Cohort[];
};

const dayNumber = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);
export const dayLabel = (day: number) => new Date(day * 86_400_000).toISOString().slice(0, 10);

function marksFor(active: ReadonlySet<number>, day0: number, today: number): Marks {
  const out = {} as Marks;
  for (const [key, [from, to]] of Object.entries(WINDOWS) as [WindowKey, readonly [number, number]][]) {
    let wrote = false;
    for (let d = day0 + from; d <= Math.min(day0 + to, today); d++) if (active.has(d)) wrote = true;
    out[key] = wrote ? true : today > day0 + to ? false : null;
  }
  return out;
}

/**
 * Share writing in each window, over projects whose window has closed. Counting open windows only
 * when they already have writes would overstate retention, so open windows wait.
 */
function retention(projects: { firstDay: number; day0: number; marks: Marks }[], today: number): Cohort["retention"] {
  const r = {} as Cohort["retention"];
  for (const [key, [, to]] of Object.entries(WINDOWS) as [WindowKey, readonly [number, number]][]) {
    const closed = projects.filter((p) => today > p.day0 + to);
    r[key] = { wrote: closed.filter((p) => p.marks[key]).length, reached: closed.length };
  }
  return r;
}

export function aggregatePulse(input: PulseInput): PulseData {
  const { period, today, firstDay } = input;
  // Projects are labelled projects; a wallet without a label is listed under its address in the
  // table but not counted as a project (the catalogue counts the same way).
  const project = (w: string) => input.projectOf.get(w) ?? w;
  const isLabelled = (w: string) => input.projectOf.has(w);
  const rows = input.includeLoad ? input.rows : input.rows.filter((r) => !input.loadWallets.has(r.wallet));

  // Per project: active days (all history) and first day.
  const activeDays = new Map<string, Set<number>>();
  for (const r of rows) if (isLabelled(r.wallet)) (activeDays.get(project(r.wallet)) ?? activeDays.set(project(r.wallet), new Set()).get(project(r.wallet))!).add(r.day);
  const firstOf = new Map([...activeDays].map(([p, days]) => [p, Math.min(...days)]));

  const totalsFor = (from: number, to: number): Totals => {
    const inRange = rows.filter((r) => r.day >= from && r.day <= to);
    const projects = new Set(inRange.filter((r) => isLabelled(r.wallet)).map((r) => project(r.wallet)));
    return {
      writes: inRange.reduce((a, r) => a + r.writes, 0),
      wallets: new Set(inRange.map((r) => r.wallet)).size,
      projects: projects.size,
      newProjects: [...firstOf].filter(([, d]) => d >= from && d <= to).length,
    };
  };

  const start = today - period + 1;
  const days: PulseDay[] = [];
  for (let d = Math.max(start, firstDay); d <= today; d++) {
    const t = totalsFor(d, d);
    days.push({ day: d, ...t });
  }
  const prevEnd = start - 1;
  const previous = prevEnd < firstDay ? null : totalsFor(Math.max(prevEnd - period + 1, firstDay), prevEnd);

  const byProject = new Map<string, ProjectActivity>();
  for (const r of rows) {
    if (r.day < start) continue;
    const p = project(r.wallet);
    const a = byProject.get(p) ?? { project: p, isLabel: input.projectOf.has(r.wallet), writes: 0, activeDays: 0, lastDay: r.day, daily: Array(period).fill(0) };
    a.writes += r.writes;
    a.lastDay = Math.max(a.lastDay, r.day);
    a.daily[r.day - start] += r.writes;
    byProject.set(p, a);
  }
  for (const a of byProject.values()) a.activeDays = a.daily.filter((n) => n > 0).length;

  // "Started in week N" cohorts: labelled projects by the week of their first write; each
  // project's own first day is its day 0.
  const weeks = new Map<number, string[]>();
  for (const [p, d] of firstOf) {
    const week = firstDay + Math.floor((d - firstDay) / 7) * 7;
    weeks.set(week, [...(weeks.get(week) ?? []), p]);
  }
  const cohorts: Cohort[] = [...weeks].sort((a, b) => a[0] - b[0]).map(([week, names]) => {
    const projects = names.sort().map((p) => ({ project: p, firstDay: firstOf.get(p)!, day0: firstOf.get(p)!, marks: marksFor(activeDays.get(p)!, firstOf.get(p)!, today) }));
    return {
      id: `week-${dayLabel(week)}`,
      label: `Started ${dayLabel(week)} to ${dayLabel(Math.min(week + 6, today))}`,
      startDay: week,
      source: "ArkivAgent index: labelled projects grouped by the week of their first write on Tiramisu",
      projects,
      retention: retention(projects, today),
    };
  });

  // Event cohorts: day 0 is the event; projects that never wrote count as not writing.
  const events: Cohort[] = (input.events ?? []).map((e) => {
    const day0 = dayNumber(e.day);
    const projects = e.projects.map((p) => ({ project: p, firstDay: firstOf.get(p) ?? -1, day0, marks: marksFor(activeDays.get(p) ?? new Set(), day0, today) }));
    return { id: e.id, label: e.label, startDay: day0, source: e.source, projects, retention: retention(projects, today) };
  });

  return {
    period, today, firstDay, days, missingDays: Math.max(0, firstDay - start),
    totals: totalsFor(Math.max(start, firstDay), today), previous,
    projects: [...byProject.values()].sort((a, b) => b.writes - a.writes).slice(0, 15),
    cohorts, events,
  };
}
