import type { Hex } from "viem";
import { describe, expect, it } from "vitest";
import { toEvents } from "../src/chain.ts";
import { createEnricher } from "../src/enrich.ts";
import { createIndexStore, type SyncRow } from "@arkiv-agent/db";
import { executeInput, fixture, str, tempDb, u64, unset } from "./helpers.ts";

const state: SyncRow = { chainId: 1, genesisHash: "0x00", indexedBlock: 0n, chainHead: 0n, syncedAtMs: 0n };
const KEY = `0x${"ab".repeat(32)}` as Hex;
const OWNER = "0x1111111111111111111111111111111111111111" as Hex;
const [T1, T2, T3] = [1, 2, 3].map((n) => `0x${String(n).repeat(64)}` as Hex);

describe("enricher", () => {
  it("replays a create and its patches, honouring tombstones and system cells", async () => {
    const { db } = tempDb();
    const inputs: Record<Hex, Hex> = {
      [T1!]: executeInput([{ create: [str("$contentType", "application/json"), str("$payload", '{"a":1}'), str("kind", "note"), u64("v", 1n)] }]),
      [T2!]: executeInput([{ other: 3 }, { patch: KEY, cells: [u64("v", 2n), unset("kind")] }]),
    };
    createIndexStore(db).applySpan([
      { kind: "created", block: 10n, logIndex: 0, tx: T1!, op: 0, key: KEY, owner: OWNER, expiresAt: 1_000n, flags: 0 },
      { kind: "patched", block: 20n, logIndex: 1, tx: T2!, op: 1, key: KEY, owner: OWNER },
    ], 30n, 0n, state);
    const enricher = createEnricher(db, async (tx) => inputs[tx]!);
    expect(await enricher.run(0n, 10, 0n)).toEqual({ written: 1, failed: 0, txs: 2 });
    expect(db.prepare(`SELECT name, type, value FROM "Attribute"`).all()).toEqual([{ name: "v", type: "u64", value: "2" }]);
    expect(db.prepare(`SELECT contentType, payloadBytes, payloadPreview, schemaSig, decodedBlock FROM "Entity"`).safeIntegers().get())
      .toEqual({ contentType: "application/json", payloadBytes: 7n, payloadPreview: '{"a":1}', schemaSig: "v:u64", decodedBlock: 20n });
    expect(enricher.pendingCount(0n)).toBe(0);
    expect(db.prepare(`SELECT kind FROM "Change" WHERE kind = 'decoded'`).pluck().all()).toEqual(["decoded"]);
  });

  it("marks an operation that is not a create as undecodable instead of retrying it", async () => {
    const { db } = tempDb();
    createIndexStore(db).applySpan([{ kind: "created", block: 10n, logIndex: 0, tx: T3!, op: 0, key: KEY, owner: OWNER, expiresAt: 1_000n, flags: 0 }], 30n, 0n, state);
    const enricher = createEnricher(db, async () => executeInput([{ other: 5 }]));
    expect(await enricher.run(0n, 10, 0n)).toMatchObject({ written: 0, failed: 1 });
    expect(enricher.pendingCount(0n)).toBe(0);
  });

  it("decodes every recorded load-generator create into a dataset signature", async () => {
    const f = fixture();
    const { db } = tempDb();
    createIndexStore(db).applySpan(toEvents(f.logs), f.toBlock, 0n, state);
    const enricher = createEnricher(db, async (tx) => f.inputs[tx]!);
    const { written, failed } = await enricher.run(0n, 1_000, 0n);
    expect(failed).toBe(0);
    expect(written).toBe(toEvents(f.logs).filter((e) => e.kind === "created").length);
    const sigs = db.prepare(`SELECT schemaSig FROM "Entity"`).pluck().all() as string[];
    expect(sigs.every((s) => s.includes("project:str"))).toBe(true);
  });

  it("samples a high-volume owner's live entities 1 in 16 by key, and skips its history", async () => {
    const { db } = tempDb();
    const keys = Array.from({ length: 32 }, (_, i) => `0x${i.toString(16).padStart(64, "0")}` as Hex);
    createIndexStore(db).applySpan(keys.map((key, i) => (
      { kind: "created" as const, block: 10n, logIndex: i, tx: T1!, op: i, key, owner: OWNER, expiresAt: i < 16 ? 1_000n : 20n, flags: 0 }
    )), 30n, 0n, state);
    const enricher = createEnricher(db, async () => "0x", { busyCreates: 10 });
    expect(enricher.pendingCount(0n)).toBe(1); // live keys 0x…00-0x…0f: only 0x…00 ends in 0
    expect(createEnricher(db, async () => "0x").pendingCount(0n)).toBe(32);
  });

  it("reads a heavily patched entity's current state instead of replaying every patch", async () => {
    const { db } = tempDb();
    const patches = Array.from({ length: 30 }, (_, i) => (
      { kind: "patched" as const, block: 20n + BigInt(i), logIndex: 0, tx: `0x${(i + 10).toString(16).padStart(64, "0")}` as Hex, op: 0, key: KEY, owner: OWNER }
    ));
    createIndexStore(db).applySpan([
      { kind: "created", block: 10n, logIndex: 0, tx: T1!, op: 0, key: KEY, owner: OWNER, expiresAt: 1_000n, flags: 0 }, ...patches,
    ], 60n, 0n, state);
    const fetched: Hex[] = [];
    const enricher = createEnricher(db, async (tx) => (fetched.push(tx), executeInput([{ create: [str("v", "old")] }])), {
      current: async () => ({ attrs: new Map([["v", { type: "str" as const, value: "now" }]]), contentType: null, payload: null }),
    });
    expect(await enricher.run(0n, 10, 0n)).toMatchObject({ written: 1, txs: 1 });
    expect(fetched).toEqual([T1]);
    expect(db.prepare(`SELECT value FROM "Attribute" WHERE name = 'v'`).pluck().get()).toBe("now");
    expect(db.prepare(`SELECT decodedBlock FROM "Entity"`).safeIntegers().pluck().get()).toBe(49n);
    expect(enricher.pendingCount(0n)).toBe(0);
  });
});
