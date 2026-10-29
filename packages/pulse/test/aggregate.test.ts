import { describe, expect, it } from "vitest";
import { type ActivityRow, aggregatePulse } from "../src/aggregate.ts";

const day0 = 20_000;
const row = (d: number, wallet: string, writes = 1): ActivityRow => ({ day: day0 + d, wallet, writes });
const base = {
  projectOf: new Map([["0xa", "alpha"], ["0xb", "beta"], ["0xc", "gamma"]]),
  loadWallets: new Set(["0xload"]),
  includeLoad: false,
  firstDay: day0,
};

describe("aggregatePulse", () => {
  const rows = [row(0, "0xa", 3), row(8, "0xa"), row(1, "0xb"), row(2, "0xc"), row(16, "0xc"), row(5, "0xload", 1000), row(9, "0xanon", 2)];

  it("leaves load generators out unless asked, and counts labelled projects only", () => {
    const p = aggregatePulse({ ...base, rows, period: 30, today: day0 + 20 });
    expect(p.totals).toEqual({ writes: 3 + 1 + 1 + 1 + 1 + 2, wallets: 4, projects: 3, newProjects: 3 });
    expect(aggregatePulse({ ...base, rows, includeLoad: true, period: 30, today: day0 + 20 }).totals.writes).toBe(1009);
    expect(p.projects.map((x) => x.project)).toContain("0xanon");
  });

  it("marks each window wrote / didn't / not closed, and counts retention over closed windows only", () => {
    const p = aggregatePulse({ ...base, rows, period: 30, today: day0 + 20 });
    const cohort = p.cohorts[0]!;
    const marks = Object.fromEntries(cohort.projects.map((x) => [x.project, x.marks]));
    expect(marks.alpha).toEqual({ d7: true, d14: null, d30: null });
    expect(marks.beta).toEqual({ d7: false, d14: null, d30: null });
    expect(marks.gamma).toEqual({ d7: false, d14: true, d30: null });
    // D7 closed for all three (day 20 > day0+13+2); D14 closed for none: gamma's write is not counted yet.
    expect(cohort.retention.d7).toEqual({ wrote: 1, reached: 3 });
    expect(cohort.retention.d14).toEqual({ wrote: 0, reached: 0 });
  });

  it("reports days before the chain started and no previous period", () => {
    const p = aggregatePulse({ ...base, rows, period: 30, today: day0 + 20 });
    expect(p.missingDays).toBe(9);
    expect(p.days).toHaveLength(21);
    expect(p.previous).toBeNull();
    expect(aggregatePulse({ ...base, rows, period: 7, today: day0 + 20 }).previous).not.toBeNull();
  });

  it("scores event cohorts from the event day, with silent projects as not writing", () => {
    const p = aggregatePulse({ ...base, rows, period: 30, today: day0 + 20, events: [{ id: "e", label: "Event", day: new Date(day0 * 86_400_000).toISOString().slice(0, 10), source: "test", projects: ["alpha", "nobody"] }] });
    expect(p.events[0]!.retention.d7).toEqual({ wrote: 1, reached: 2 });
  });
});
