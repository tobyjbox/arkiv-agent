import { describe, expect, it } from "vitest";
import { announcement, formatEta, formatPercent, formatRate, paceText, phase, quarter, rate, smoothEta, track, type Tracker } from "./decode-progress";

/** Polls every 5 s, waiting counts in order. */
const run = (counts: number[], start = 0, step = 5_000): Tracker =>
  counts.reduce<Tracker | null>((t, waiting, i) => track(t, { at: start + i * step, waiting }), null)!;
const fall = (from: number, by: number, n: number) => Array.from({ length: n }, (_, i) => from - i * by);

describe("rate and ETA (design/07)", () => {
  it("shows no rate until the window spans 30 s and 3 samples, then drops per minute", () => {
    expect(rate(run([800, 790]).samples)).toBeNull();
    expect(rate(run(fall(800, 10, 6)).samples)).toBeNull(); // 25 s
    expect(rate(run(fall(800, 10, 7)).samples)).toBe(120); // 30 s, 60 decoded
  });

  it("waits 60 s of positive rate before an ETA, then smooths it", () => {
    expect(run(fall(800, 10, 12)).eta).toBeNull(); // positive from 30 s, only 25 s so far
    const t = run(fall(800, 10, 20));
    expect(t.eta).toBeCloseTo((800 - 190) / 120, 5);
    expect(smoothEta(10, 30, 500)).toBe(15);
    expect(smoothEta(10, 1, 500)).toBe(5);
    expect(smoothEta(10, 0, 0)).toBe(0);
  });

  it("formats rate, ETA and percent as specced", () => {
    expect(formatRate(143.7)).toBe("~140 / min");
    expect(formatRate(1_234)).toBe("~1,200 / min");
    expect(formatEta(0.4)).toBe("under a minute");
    expect(formatEta(6.4)).toBe("about 6 min left");
    expect(formatEta(200)).toBe("about 3 h left");
    expect(formatPercent(36_496, 37_288)).toBe("97.8%");
    expect(formatPercent(37_287, 37_288)).toBe("99.9%");
    expect(formatPercent(37_288, 37_288)).toBe("100%");
  });
});

describe("phase (design/07 states)", () => {
  const total = 37_288;
  it("decoding while falling, nearly done near the end", () => {
    const t = run(fall(800, 10, 8));
    expect(phase(t, 40_000, total, "live")).toBe("decoding");
    expect(phase(run(fall(60, 1, 8)), 40_000, total, "live")).toBe("nearly-done");
  });

  it("keeping pace when not falling over 60 s, stalled when unchanged for 2 min", () => {
    const flat = [778, 780, 777, 778, 781, 779, 778, 780, 779, 778, 780, 779, 780];
    expect(phase(run(flat), 60_000, total, "live")).toBe("keeping-pace");
    const still = run(Array(25).fill(778));
    expect(phase(still, 60_000, total, "live")).toBe("keeping-pace");
    expect(phase(still, 120_000, total, "live")).toBe("stalled");
  });

  it("first run when nothing is decoded yet; paused when offline or the indexer stopped; delayed changes nothing", () => {
    expect(phase(run([total, total + 2]), 5_000, total + 2, "live")).toBe("first-run");
    const t = run(fall(800, 10, 8));
    expect(phase(t, 40_000, total, "offline")).toBe("offline");
    expect(phase(t, 40_000, total, "stale")).toBe("stale");
    expect(phase(t, 40_000, total, "delayed")).toBe("decoding");
  });

  it("says keeping pace instead of a rate, and the rate and ETA once known", () => {
    expect(paceText("keeping-pace", run([5, 6, 7]))).toBe("keeping pace with new writes");
    expect(paceText("decoding", run(fall(800, 10, 3)))).toBeNull();
    expect(paceText("decoding", run(fall(800, 10, 20)))).toBe("~120 / min · about 5 min left");
    expect(paceText("nearly-done", run(fall(45, 1, 8)))).toBe("~12 / min · under a minute");
  });
});

describe("announcement cadence", () => {
  const at = (phase: Parameters<typeof announcement>[1]["phase"], percent: number, t: number) => ({ phase, quarter: quarter(percent), at: t });
  it("speaks on first appearance and at each 25% crossed, at most every 30 s", () => {
    expect(announcement(null, at("decoding", 97.9, 0), "97.9%")).toBe("Decoding records: 97.9% done.");
    expect(announcement(at("decoding", 49, 0), at("decoding", 51, 10_000), "51.0%")).toBeNull();
    expect(announcement(at("decoding", 49, 0), at("decoding", 51, 31_000), "51.0%")).toBe("Decoding records: 51.0% done.");
    expect(announcement(at("decoding", 51, 0), at("decoding", 60, 60_000), "60.0%")).toBeNull();
  });

  it("speaks on stalled and offline, and always on caught up", () => {
    expect(announcement(at("decoding", 60, 0), at("stalled", 60, 40_000), "60.0%")).toMatch(/paused: no progress/);
    expect(announcement(at("decoding", 60, 0), at("offline", 60, 40_000), "60.0%")).toMatch(/isn't updating/);
    expect(announcement(at("decoding", 99, 0), at("caught-up", 100, 1_000), "100%")).toBe("All records decoded.");
  });
});
