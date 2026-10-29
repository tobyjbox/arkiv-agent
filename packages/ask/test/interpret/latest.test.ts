import { describe, expect, it } from "vitest";
import { resultLimit, sortNote } from "../../src/interpret/conditions/latest.ts";
import { startParse } from "../../src/interpret/parse.ts";
import { MAX_RESULTS } from "../../src/query.ts";
import { context } from "./helpers.ts";

const run = (q: string) => {
  const p = startParse(q, context([]));
  resultLimit(p);
  sortNote(p);
  return p;
};

describe("resultLimit and sortNote", () => {
  it("'first 10' is a count and uses up both words", () => {
    const p = run("first 10 readings");
    expect(p.limit).toBe(10);
    expect([...p.consumed].sort()).toEqual([0, 1]);
    expect(p.explain).toEqual([]);
  });

  it("'latest 5' sets the count but leaves 'latest' free, so the note says Arkiv can't sort", () => {
    const p = run("latest 5 readings");
    expect(p.limit).toBe(5);
    expect([...p.consumed]).toEqual([1]);
    expect(p.explain).toEqual(["Arkiv can't sort query results, so newest-first isn't applied: these are the first records it returns."]);
  });

  it("'last 7 days' is a time window, not a count", () => {
    expect(run("last 7 days").limit).toBe(MAX_RESULTS);
  });

  it("caps the count", () => {
    expect(run("top 999 readings").limit).toBe(MAX_RESULTS);
  });
});
