import { describe, expect, it } from "vitest";
import { buildDatasets, hourlySeries, type Member } from "../src/build.ts";
import {
  type Attr, classifyOwnership, datasetName, discriminatorOf, groupKey, labelGroups, median, normalizeAttrName, normalizeLabel, projectOf,
} from "../src/infer.ts";

const attrs = (o: Record<string, string | [Attr["type"], string]>) =>
  new Map(Object.entries(o).map(([k, v]) => [k, typeof v === "string" ? { type: "str" as const, value: v } : { type: v[0], value: v[1] }]));

let n = 0;
const member = (owner: string, a: ReturnType<typeof attrs>, over: Partial<Member> = {}): Member => ({
  key: `0x${(n++).toString(16).padStart(64, "0")}`, owner, status: "live", createdAtBlock: 1_000, updatedAtBlock: 1_000,
  expiresAt: 1_900, contentType: "application/json", payloadBytes: 100, attrs: a, ...over,
});

describe("normalization", () => {
  it("drops generated suffixes from attribute names and labels", () => {
    expect(normalizeAttrName("random_number_0_dc6812240366360d")).toBe("random_number_0_*");
    expect(normalizeAttrName("temp_c_x100")).toBe("temp_c_x100");
    expect(normalizeLabel("supercall-test-1793010381266")).toBe("supercall-test-*");
    expect(normalizeLabel("blackout-v2-7f3c9a")).toBe("blackout-v2-7f3c9a");
  });
});

describe("attribution and grouping", () => {
  it("prefers a project label, else falls back to the writer", () => {
    expect(projectOf(attrs({ app: "tideland" }), "0xAbC")).toEqual({ method: "label", label: "tideland", labelAttr: "app", isPrefix: false });
    expect(projectOf(attrs({ project: "run-1793010381266" }), "0x1")).toMatchObject({ label: "run-*", isPrefix: true });
    expect(projectOf(attrs({ project: ["u64", "7"] }), "0xAbC")).toEqual({ method: "creator", label: "0xabc", labelAttr: null, isPrefix: false });
  });

  it("splits a project by its kind/type value, else by shape", () => {
    expect(discriminatorOf(attrs({ type: "x", kind: "note" }))).toEqual({ name: "kind", value: "note" });
    const a = groupKey(attrs({ project: "p", kind: "note", body: "1" }), "0x1");
    const b = groupKey(attrs({ project: "p", kind: "note", tags: "2" }), "0x2");
    const c = groupKey(attrs({ project: "p", body: "1" }), "0x1");
    expect(a.key).toBe(b.key);
    expect(c.key).toBe("label:p|shape=body:str,project:str");
  });

  it("names datasets by discriminator, else by their most specific fields", () => {
    expect(datasetName({ value: "note" }, ["kind", "body"])).toBe("note");
    expect(datasetName(null, ["project", "eta", "dest_zone", "tier", "type"])).toBe("eta · dest_zone · tier");
  });
});

describe("ownership", () => {
  it("app for a few writers, mixed when one dominates, user when spread out", () => {
    expect(classifyOwnership([500])).toBe("app");
    expect(classifyOwnership([3, 3, 3])).toBe("app");
    expect(classifyOwnership([90, 3, 3, 4])).toBe("mixed");
    expect(classifyOwnership([5, 4, 6, 5, 5])).toBe("user");
  });
});

describe("label conflicts", () => {
  it("counts groups of datasets that share no writer", () => {
    expect(labelGroups([new Set(["a"]), new Set(["a", "b"])])).toBe(1);
    expect(labelGroups([new Set(["a"]), new Set(["b"]), new Set(["b", "c"])])).toBe(2);
  });
});

describe("buildDatasets", () => {
  const ctx = { indexedBlock: 2_000, busyOwners: new Set(["0xbusy"]) };

  it("builds schema presence, writers, lifetime and the 24 h series", () => {
    const ms = [
      member("0x1", attrs({ project: "p", kind: "note", body: "hi", n: ["i32", "1"] }), { createdAtBlock: 1_999, expiresAt: 2_899 }),
      member("0x1", attrs({ project: "p", kind: "note", body: "yo" }), { expiresAt: null }),
      member("0x2", attrs({ project: "p", kind: "note", body: "ok" }), { status: "expired" }),
    ];
    const [d] = buildDatasets(ms, ctx).datasets;
    expect(d).toMatchObject({ name: "note", liveCount: 2, writers: 1, ownership: "app", soleOwner: "0x1", medianLifetimeBlocks: 900, writes24h: 3 });
    expect(d!.schema.find((f) => f.name === "n")).toMatchObject({ type: "i32", presence: 0.5, examples: ["1"] });
    expect(d!.project).toMatchObject({ method: "label", label: "p", confidence: 0.92, conflictWallets: null });
  });

  it("flags label conflicts and load generators", () => {
    const { datasets } = buildDatasets([
      member("0x1", attrs({ project: "shared", kind: "a" })),
      member("0x2", attrs({ project: "shared", kind: "b" })),
      member("0xbusy", attrs({ project: "gen", r_0_dc6812240366360d: "x" })),
      member("0xbusy", attrs({ project: "gen", r_0_aaaaaaaaaaaaaaaa: "y" })),
    ], ctx);
    expect(datasets.filter((d) => d.project.label === "shared").map((d) => d.project.conflictWallets)).toEqual([2, 2]);
    const gen = datasets.find((d) => d.project.label === "gen")!;
    expect(gen).toMatchObject({ isLoadGenerator: true, liveCount: 2, name: "r_0_*" });
  });

  it("buckets writes by hour, oldest first", () => {
    expect(hourlySeries([2_000, 1_999, 199, 5_000], 2_000, 3)).toEqual([0, 1, 2]);
    expect(median([5, 1, 3])).toBe(3);
    expect(median([])).toBeNull();
  });
});
