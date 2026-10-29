import { describe, expect, it } from "vitest";
import { datasetSnippet } from "../src/snippet.ts";

const base = { discriminator: null, shape: null, unqueryable: null };

describe("datasetSnippet", () => {
  it("queries a labelled dataset by label and kind, with the SDK's own query string", () => {
    const s = datasetSnippet({ ...base, project: { label: "tideland", method: "label", labelAttr: "app", isPrefix: false, confidence: 0.92, conflictWallets: null }, discriminator: { name: "kind", value: "sign" } });
    expect(s.query).toBe("app = str('tideland') AND kind = str('sign')");
    expect(s.typescript).toContain('eq("kind", str("sign"))');
    expect(s.typescript).toContain(".atBlock(head)");
  });

  it("uses a prefix for normalized labels and the owner for unlabelled data", () => {
    const prefix = datasetSnippet({ ...base, project: { label: "run-*", method: "label", labelAttr: "project", isPrefix: true, confidence: 0.6, conflictWallets: 2 } });
    expect(prefix.query).toContain('STARTSWITH');
    const owner = "0x00000000000000000000000000000000000000aa";
    const byOwner = datasetSnippet({ ...base, project: { label: owner, method: "creator", labelAttr: null, isPrefix: false, confidence: 0.55, conflictWallets: null } });
    expect(byOwner.query).toBe("$owner = addr(0x00000000000000000000000000000000000000AA)");
  });

  it("reads a shape-named dataset back with presence checks the node accepts, never EXISTS (T21 M1)", () => {
    const s = datasetSnippet({ ...base, project: { label: "p", method: "label", labelAttr: "project", isPrefix: false, confidence: 0.9, conflictWallets: null },
      shape: { has: [{ name: "eta", type: "u64" }, { name: "seq", type: "i32" }], lacks: [{ name: "kw", type: "str" }] } });
    expect(s.query).toBe("project = str('p') AND eta >= u64(0) AND seq >= i32(-2147483648) AND NOT kw STARTSWITH str('')");
    expect(s.typescript).toContain('gte("eta", u64(0n))');
    expect(s.typescript).toContain('not(startsWith("kw", ""))');
    expect(s.typescript).toContain("import { and, not, eq, gte, startsWith } from");
    expect(s.typescript).toContain("import { str, i32, u64 } from");
    expect(s.query + s.typescript).not.toMatch(/exists/i);
  });

  it("offers no query for a browse-only dataset, and keeps the reason on one comment line", () => {
    const s = datasetSnippet({ ...base, project: { label: "p", method: "label", labelAttr: "project", isPrefix: false, confidence: 0.9, conflictWallets: null },
      unqueryable: "2 other live records labelled project = p\nconsole.log(1) differ" });
    expect(s.query).toBe("");
    expect(s.typescript.split("\n")).toHaveLength(1);
    expect(s.typescript).toMatch(/^\/\/ One query can't read this dataset back yet: 2 other/);
  });
});
