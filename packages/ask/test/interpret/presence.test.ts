import { describe, expect, it } from "vitest";
import { presence } from "../../src/interpret/conditions/presence.ts";
import { dataset, field, parseFor } from "./helpers.ts";

describe("presence", () => {
  it("explains that 'without a field' can't be applied, and leaves the words free", () => {
    const p = parseFor("notes without a parent_key", dataset([field("parent_key", "str", ["0x01"])]));
    presence(p);
    expect(p.conds).toEqual([]);
    expect(p.consumed.size).toBe(0);
    expect(p.explain).toEqual(["Arkiv can't yet filter on whether a record has parent_key at all (the node rejects EXISTS), so that part isn't applied."]);
  });

  it("says nothing when a value follows ('with guild alpha' is a value, not presence)", () => {
    const p = parseFor("players with guild alpha", dataset([field("guild", "str", ["alpha"])]));
    presence(p);
    expect(p.explain).toEqual([]);
  });
});
