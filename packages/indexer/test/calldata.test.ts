import { describe, expect, it } from "vitest";
import { decodeOps } from "../src/calldata.ts";
import { toEvents } from "../src/chain.ts";
import { executeInput, fixture, str } from "./helpers.ts";

describe("decodeOps", () => {
  it("round-trips a synthetic create, patch and delete", () => {
    const key = `0x${"11".repeat(32)}` as const;
    const ops = decodeOps(executeInput([{ create: [str("a", "1")], minLifetime: 900n }, { patch: key, cells: [str("a", "2")] }, { other: 5 }]));
    expect(ops.map((o) => o.kind)).toEqual(["create", "patch", "other"]);
    expect(ops[0]).toMatchObject({ kind: "create", minLifetime: 900n });
    expect(ops[1]).toMatchObject({ kind: "patch", entityKey: key });
  });

  it("decodes every recorded Tiramisu transaction, one create per EntityCreated log", () => {
    const f = fixture();
    const created = toEvents(f.logs).filter((e) => e.kind === "created");
    expect(created.length).toBeGreaterThan(0);
    for (const e of created) expect(decodeOps(f.inputs[e.tx]!)[e.op]?.kind).toBe("create");
  });
});
