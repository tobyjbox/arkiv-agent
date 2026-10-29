import { describe, expect, it } from "vitest";
import { datasetSnippet } from "../src/snippet.ts";

const base = { discriminator: null, schema: [], soleOwner: null };

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
    const byOwner = datasetSnippet({ ...base, project: { label: owner, method: "creator", labelAttr: null, isPrefix: false, confidence: 0.55, conflictWallets: null },
      schema: [{ name: "eta", type: "u64", presence: 1, examples: [] }, { name: "r_*", type: "str", presence: 1, examples: [] }] });
    expect(byOwner.query).toContain("$owner");
    expect(byOwner.query).toContain("EXISTS(eta)");
    expect(byOwner.query).not.toContain("r_*");
  });
});
