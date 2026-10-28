import type { DatasetRow } from "./catalogue";
import { BLOCK_SECONDS } from "./format";

export const SORTS = { active: "Most active", records: "Most records", newest: "Newest", recent: "Recently written", name: "Name" } as const;
export const FRESHNESS = { hour: "Written in last hour", day: "Last day", week: "Last week", quiet: "Quiet over a week" } as const;
export type Sort = keyof typeof SORTS;
export type Freshness = keyof typeof FRESHNESS;

/** View state, round-tripped through the URL so views can be shared and Back works. */
export type View = { q: string; project: string[]; ownership: string[]; freshness: Freshness | null; content: string[]; sort: Sort; showLoadGen: boolean };

export function viewFromParams(p: URLSearchParams): View {
  const list = (k: string) => p.get(k)?.split(",").filter(Boolean) ?? [];
  const sort = p.get("sort");
  const fresh = p.get("fresh");
  return {
    q: p.get("q") ?? "", project: list("project"), ownership: list("own"), content: list("ct"),
    freshness: fresh && fresh in FRESHNESS ? (fresh as Freshness) : null,
    sort: sort && sort in SORTS ? (sort as Sort) : "active", showLoadGen: p.get("lg") === "1",
  };
}

export function viewToParams(v: View): string {
  const p = new URLSearchParams();
  if (v.q) p.set("q", v.q);
  if (v.project.length) p.set("project", v.project.join(","));
  if (v.ownership.length) p.set("own", v.ownership.join(","));
  if (v.content.length) p.set("ct", v.content.join(","));
  if (v.freshness) p.set("fresh", v.freshness);
  if (v.sort !== "active") p.set("sort", v.sort);
  if (v.showLoadGen) p.set("lg", "1");
  return p.toString();
}

/** Seconds since a dataset's last write, from the index head and how long ago the index synced. */
export const writeAgeSeconds = (row: DatasetRow, chainHead: number, secondsSinceSync: number) =>
  Math.max(0, (chainHead - row.lastWriteBlock) * BLOCK_SECONDS + secondsSinceSync);

const freshnessOf = (age: number): Freshness => (age < 3_600 ? "hour" : age < 86_400 ? "day" : age < 604_800 ? "week" : "quiet");

export function matchesQuery(row: DatasetRow, q: string, description?: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [row.name, row.project.label, description ?? "", ...row.fields.map((f) => f.name)].some((s) => s.toLowerCase().includes(needle));
}

export function applyView(rows: readonly DatasetRow[], v: View, ageOf: (r: DatasetRow) => number): DatasetRow[] {
  const fresh = (r: DatasetRow) => {
    if (!v.freshness) return true;
    const f = freshnessOf(ageOf(r));
    return v.freshness === "quiet" ? f === "quiet" : ["hour", "day", "week"].indexOf(f) <= ["hour", "day", "week"].indexOf(v.freshness);
  };
  const kept = rows.filter((r) =>
    (v.showLoadGen || !r.isLoadGenerator) && matchesQuery(r, v.q) && fresh(r)
    && (!v.project.length || v.project.includes(r.project.label))
    && (!v.ownership.length || v.ownership.includes(r.ownership))
    && (!v.content.length || r.contentTypes.some((c) => v.content.includes(c))));
  const by: Record<Sort, (a: DatasetRow, b: DatasetRow) => number> = {
    active: (a, b) => b.writes24h - a.writes24h || b.liveCount - a.liveCount,
    records: (a, b) => b.liveCount - a.liveCount,
    newest: (a, b) => b.firstWriteBlock - a.firstWriteBlock,
    recent: (a, b) => b.lastWriteBlock - a.lastWriteBlock,
    name: (a, b) => a.name.localeCompare(b.name),
  };
  return kept.sort((a, b) => by[v.sort](a, b) || a.id.localeCompare(b.id));
}

/** Counts per option for filter popovers, over the rows other filters leave. */
export function countBy(rows: readonly DatasetRow[], key: (r: DatasetRow) => string[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const r of rows) for (const k of key(r)) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
