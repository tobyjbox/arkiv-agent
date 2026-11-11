import { BUSY_OWNER_CREATES, createIndexStore, createPrisma, liveCounts, readFeed, type SyncRow } from "@arkiv-agent/db";
import type { Hex } from "viem";
import { describe, expect, it } from "vitest";
import { tempDb } from "./helpers.ts";

const OWNER = "0x1111111111111111111111111111111111111111" as Hex;
const key = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as Hex;
const state: SyncRow = { chainId: 1, genesisHash: "0x00", indexedBlock: 0n, chainHead: 120n, syncedAtMs: 1_700_000_000_000n };

describe("readFeed", () => {
  it("returns changes after a cursor, resets without one, and reports lag", async () => {
    const { db, path } = tempDb();
    const store = createIndexStore(db);
    store.applySpan([{ kind: "created", block: 10n, logIndex: 0, tx: key(9), op: 0, key: key(1), owner: OWNER, expiresAt: 500n, flags: 0 }], 100n, 0n, state);
    const prisma = createPrisma(`file:${path}`);

    const first = await readFeed(prisma, null);
    expect(first).toMatchObject({ reset: true, cursor: "1", indexedBlock: "100", lagBlocks: "20", isBehind: true, liveCount: 1, undecodedLive: 1 });

    store.applySpan([{ kind: "deleted", block: 110n, logIndex: 0, tx: key(8), op: 0, key: key(1), owner: OWNER }], 118n, 0n, state);
    const next = await readFeed(prisma, Number(first.cursor));
    expect(next).toMatchObject({ reset: false, cursor: "2", indexedBlock: "118", isBehind: false, liveCount: 0, undecodedLive: 0 });
    expect(next.changes.map((c) => [c.kind, c.block])).toEqual([["deleted", "110"]]);
    expect(await readFeed(prisma, 2)).toMatchObject({ reset: false, changes: [] });
    await prisma.$disconnect();
  });

  it("counts as waiting only what the decoder will decode: 1 in 16 of a load generator's records", async () => {
    const { db, path } = tempDb();
    const store = createIndexStore(db);
    const BUSY = "0x2222222222222222222222222222222222222222" as Hex;
    const created = (n: number, owner: Hex) => ({ kind: "created" as const, block: 10n, logIndex: n, tx: key(9), op: n, key: key(n), owner, expiresAt: 500n, flags: 0 });
    // 5,001 creates make BUSY a load generator; 312 of its hex keys end in 0. One ordinary record besides.
    store.applySpan([...Array.from({ length: BUSY_OWNER_CREATES + 1 }, (_, i) => created(i + 1, BUSY)), created(BUSY_OWNER_CREATES + 2, OWNER)], 100n, 0n, state);
    const prisma = createPrisma(`file:${path}`);

    const feed = await readFeed(prisma, null);
    expect(feed.liveCount).toBe(BUSY_OWNER_CREATES + 2);
    expect(feed.undecodedLive).toBe(312 + 1);
    expect(liveCounts([BUSY], db)).toEqual({ live: BUSY_OWNER_CREATES + 2, undecoded: 312 + 1 });
    await prisma.$disconnect();
  });
});
