import { describe, expect, it } from "vitest";
import { pickDataset, rankDatasets } from "../../src/interpret/dataset.ts";
import { startParse } from "../../src/interpret/parse.ts";
import { context, dataset, field } from "./helpers.ts";

const readings = dataset([field("city", "str", ["noida"])], { liveCount: 50 });
const salaries = dataset([field("ctc", "i32", ["1"])], {
  id: "ds2", name: "salaries", discriminator: { name: "kind", value: "salary" }, liveCount: 500,
  project: { label: "tankha", method: "label", labelAttr: "project", isPrefix: false, confidence: 1, conflictWallets: null },
});
const pick = (q: string, extra = {}) => {
  const p = startParse(q, context([readings, salaries], extra));
  return { result: pickDataset(p), p };
};

describe("pickDataset", () => {
  it("picks the dataset the question names, uses up its words and says why", () => {
    const { result, p } = pick("tankha salaries over 10");
    expect(result).toBeNull();
    expect(p.dataset?.id).toBe("ds2");
    expect([...p.consumed].sort()).toEqual([0, 1]);
    expect(p.explain).toEqual(["Dataset “salaries” from tankha (500 live records), the best match in the catalogue."]);
  });

  it("uses the scope without scoring", () => {
    const { p } = pick("anything at all", { scope: "ds1" });
    expect(p.dataset?.id).toBe("ds1");
    expect(p.explain).toEqual([]);
  });

  it("falls back to the previous turn's dataset for a follow-up", () => {
    const { p } = pick("only in noida", { previous: { datasetId: "ds2", where: null, limit: 50, explain: [], ignored: [] } });
    expect(p.dataset?.id).toBe("ds2");
  });

  it("is not understood when nothing names a dataset and there's no address", () => {
    expect(pick("what's the weather in Lisbon")).toMatchObject({ result: { kind: "not-understood" } });
  });
});

describe("rankDatasets", () => {
  it("puts named datasets first, then the largest", () => {
    expect(rankDatasets("sensornet readings", [salaries, readings]).map((d) => d.id)).toEqual(["ds1", "ds2"]);
    expect(rankDatasets("nothing named", [readings, salaries]).map((d) => d.id)).toEqual(["ds2", "ds1"]);
  });
});
