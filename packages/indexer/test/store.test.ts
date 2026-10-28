import type { Hex } from "viem";
import { describe, expect, it } from "vitest";
import { type EntityEvent, toEvents } from "../src/chain.ts";
import { clampExpiry, createStore, type SyncRow } from "../src/store.ts";
import { fixture, tempDb } from "./helpers.ts";

const k = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as Hex;
const O1 = "0x1111111111111111111111111111111111111111" as Hex;
const O2 = "0x2222222222222222222222222222222222222222" as Hex;
const T = (n: number) => `0x${n.toString(16).padStart(64, "a")}` as Hex;
const state: SyncRow = { chainId: 1, genesisHash: "0x00", indexedBlock: 0n, chainHead: 100n, syncedAtMs: 0n };

/** A, B, C: A is patched, extended and transferred; B expires at 50; C is deleted. */
const lifecycle: EntityEvent[] = [
  { kind: "created", block: 10n, logIndex: 0, tx: T(1), op: 0, key: k(1), owner: O1, expiresAt: 1_000n, flags: 0 },
  { kind: "created", block: 10n, logIndex: 1, tx: T(1), op: 1, key: k(2), owner: O1, expiresAt: 50n, flags: 0 },
  { kind: "patched", block: 20n, logIndex: 0, tx: T(2), op: 0, key: k(1), owner: O1 },
  { kind: "extended", block: 30n, logIndex: 0, tx: T(3), op: 0, key: k(1), owner: O1, expiresAt: 2n ** 64n - 1n },
  { kind: "transferred", block: 40n, logIndex: 0, tx: T(4), op: 0, key: k(1), owner: O2 },
  { kind: "created", block: 45n, logIndex: 0, tx: T(5), op: 0, key: k(3), owner: O1, expiresAt: 3_000n, flags: 1 },
  { kind: "deleted", block: 60n, logIndex: 0, tx: T(6), op: 0, key: k(3), owner: O1 },
];

function snapshot(db: ReturnType<typeof tempDb>["db"]) {
  return {
    entities: db.prepare(`SELECT key, owner, status, expiresAt, deletedAtBlock, updatedAtBlock FROM "Entity" ORDER BY key`).safeIntegers().all(),
    patches: db.prepare(`SELECT * FROM "Patch"`).safeIntegers().all(),
    changes: db.prepare(`SELECT block, kind, entityKey FROM "Change" ORDER BY seq`).safeIntegers().all() as { block: bigint; kind: string; entityKey: string }[],
    cursor: createStore(db).readState()?.indexedBlock,
  };
}

describe("applySpan", () => {
  it("tracks live, expired and deleted, and clamps a u64-max expiry", () => {
    const { db } = tempDb();
    createStore(db).applySpan(lifecycle, 100n, 0n, state);
    const s = snapshot(db);
    expect(s.entities).toEqual([
      { key: k(1), owner: O2, status: "live", expiresAt: clampExpiry(2n ** 64n - 1n), deletedAtBlock: null, updatedAtBlock: 40n },
      { key: k(2), owner: O1, status: "expired", expiresAt: 50n, deletedAtBlock: null, updatedAtBlock: 10n },
      { key: k(3), owner: O1, status: "deleted", expiresAt: 3_000n, deletedAtBlock: 60n, updatedAtBlock: 60n },
    ]);
    expect(s.patches).toHaveLength(1);
    expect(s.changes.map((c) => c.kind)).toEqual(["created", "created", "patched", "extended", "transferred", "created", "deleted", "expired"]);
    expect(s.cursor).toBe(100n);
  });

  it("is safe to re-run: the same span twice leaves the same state", () => {
    const { db } = tempDb();
    const store = createStore(db);
    store.applySpan(lifecycle, 100n, 0n, state);
    const once = snapshot(db);
    store.applySpan(lifecycle, 100n, 0n, state);
    expect(snapshot(db)).toEqual(once);
  });

  it("writes feed rows only above the floor, and prunes below it", () => {
    const { db } = tempDb();
    createStore(db).applySpan(lifecycle, 100n, 40n, state);
    expect(snapshot(db).changes.map((c) => [c.kind, c.block])).toEqual([["created", 45n], ["deleted", 60n], ["expired", 50n]]);
  });

  it("indexes a recorded Tiramisu window: every create becomes an entity", () => {
    const f = fixture();
    const events = toEvents(f.logs);
    const { db } = tempDb();
    createStore(db).applySpan(events, f.toBlock, 0n, state);
    const created = events.filter((e) => e.kind === "created");
    const live = created.filter((e) => e.kind === "created" && e.expiresAt > f.toBlock).length;
    const count = (status: string) => (db.prepare(`SELECT COUNT(*) AS n FROM "Entity" WHERE status = ?`).get(status) as { n: number }).n;
    expect(count("live") + count("expired") + count("deleted")).toBe(created.length);
    expect(count("live")).toBe(live);
  });
});
