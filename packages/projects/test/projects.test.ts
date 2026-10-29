import { describe, expect, it } from "vitest";
import { assignProjects, countDatasetsByProject } from "../src/projects.ts";

const ds = (id: string, label: string, method = "label", isLoadGenerator = false) => ({ id, isLoadGenerator, project: { method, label } });

describe("assignProjects", () => {
  const datasets = [ds("a1", "alpha"), ds("b1", "beta"), ds("w1", "0xC", "creator")];
  const members = new Map([
    ["a1", [{ owner: "0xA" }, { owner: "0xa" }, { owner: "0xB" }]],
    ["b1", [{ owner: "0xa" }, { owner: "0xB" }, { owner: "0xb" }]],
    ["w1", [{ owner: "0xC" }]],
  ]);

  it("gives each wallet, lowercased, the label on most of its records", () => {
    expect(assignProjects(datasets, members)).toEqual(new Map([["0xa", "alpha"], ["0xb", "beta"]]));
  });

  it("leaves out wallets seen only in datasets named after their creator", () => {
    expect(assignProjects(datasets, members).has("0xc")).toBe(false);
  });

  it("breaks a tie in favour of the dataset listed first", () => {
    const tie = new Map([["a1", [{ owner: "0xd" }]], ["b1", [{ owner: "0xd" }]]]);
    expect(assignProjects(datasets, tie).get("0xd")).toBe("alpha");
  });
});

describe("countDatasetsByProject", () => {
  it("counts datasets per label and leaves out load generators", () => {
    const datasets = [ds("a1", "alpha"), ds("a2", "alpha"), ds("b1", "beta"), ds("r1", "r_0_*", "label", true)];
    expect(countDatasetsByProject(datasets)).toEqual({ alpha: 2, beta: 1 });
  });
});
