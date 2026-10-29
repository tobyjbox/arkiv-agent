import type { Sqlite } from "@arkiv-agent/db";
import { FEED_WINDOW_BLOCKS } from "@arkiv-agent/db";
import type { EntityEvent } from "./chain.ts";

const I64_MAX = 2n ** 63n - 1n;
/** SQLite integers are signed 64-bit; "never" expiries (u64 max) are stored as i64 max. */
export const clampExpiry = (block: bigint) => (block > I64_MAX ? I64_MAX : block);

export type SyncRow = { chainId: number; genesisHash: string; indexedBlock: bigint; chainHead: bigint; syncedAtMs: bigint };

/** Prepared statements over the Prisma-managed schema. Every write path is idempotent. */
export function createStore(db: Sqlite) {
  const s = {
    create: db.prepare(`INSERT INTO "Entity" (key, owner, creator, createdAtBlock, createdTx, createdOp, updatedAtBlock, expiresAt, status, creationFlags)
      VALUES (@key, @owner, @owner, @block, @tx, @op, @block, @expiresAt, 'live', @flags)
      ON CONFLICT(key) DO UPDATE SET owner = excluded.owner, creator = excluded.creator, createdAtBlock = excluded.createdAtBlock,
        createdTx = excluded.createdTx, createdOp = excluded.createdOp, updatedAtBlock = excluded.updatedAtBlock,
        expiresAt = excluded.expiresAt, status = 'live', deletedAtBlock = NULL, creationFlags = excluded.creationFlags`),
    touch: db.prepare(`UPDATE "Entity" SET owner = @owner, updatedAtBlock = @block WHERE key = @key`),
    patch: db.prepare(`INSERT OR IGNORE INTO "Patch" (entityKey, block, logIndex, tx, op) SELECT @key, @block, @logIndex, @tx, @op WHERE EXISTS (SELECT 1 FROM "Entity" WHERE key = @key)`),
    extend: db.prepare(`UPDATE "Entity" SET owner = @owner, updatedAtBlock = @block, expiresAt = @expiresAt WHERE key = @key`),
    remove: db.prepare(`UPDATE "Entity" SET owner = @owner, updatedAtBlock = @block, status = 'deleted', deletedAtBlock = @block WHERE key = @key`),
    change: db.prepare(`INSERT OR IGNORE INTO "Change" (block, kind, entityKey, owner) VALUES (@block, @kind, @key, @owner)`),
    expiredFeed: db.prepare(`INSERT OR IGNORE INTO "Change" (block, kind, entityKey, owner)
      SELECT expiresAt, 'expired', key, owner FROM "Entity" WHERE status = 'live' AND expiresAt <= @to AND expiresAt > @floor ORDER BY expiresAt`),
    expire: db.prepare(`UPDATE "Entity" SET status = 'expired' WHERE status = 'live' AND expiresAt <= @to`),
    prune: db.prepare(`DELETE FROM "Change" WHERE block <= @floor`),
    readState: db.prepare(`SELECT chainId, genesisHash, indexedBlock, chainHead, syncedAtMs FROM "SyncState" WHERE id = 1`).safeIntegers(),
    writeState: db.prepare(`INSERT INTO "SyncState" (id, chainId, genesisHash, indexedBlock, chainHead, syncedAtMs)
      VALUES (1, @chainId, @genesisHash, @indexedBlock, @chainHead, @syncedAtMs)
      ON CONFLICT(id) DO UPDATE SET indexedBlock = excluded.indexedBlock, chainHead = excluded.chainHead, syncedAtMs = excluded.syncedAtMs`),
  };

  /** Applies one span's events, expires what lapsed by `to`, and advances the cursor, atomically. */
  const applySpan = db.transaction((events: readonly EntityEvent[], to: bigint, feedFloor: bigint, state: SyncRow) => {
    for (const e of events) {
      const row = { key: e.key, owner: e.owner, block: e.block };
      if (e.kind === "created") s.create.run({ ...row, tx: e.tx, op: e.op, expiresAt: clampExpiry(e.expiresAt), flags: e.flags });
      else if (e.kind === "patched") { s.touch.run(row); s.patch.run({ ...row, logIndex: e.logIndex, tx: e.tx, op: e.op }); }
      else if (e.kind === "extended") s.extend.run({ ...row, expiresAt: clampExpiry(e.expiresAt) });
      else if (e.kind === "transferred") s.touch.run(row);
      else s.remove.run(row);
      if (e.block > feedFloor) s.change.run({ ...row, kind: e.kind });
    }
    s.expiredFeed.run({ to, floor: feedFloor });
    s.expire.run({ to });
    s.prune.run({ floor: feedFloor });
    s.writeState.run({ ...state, indexedBlock: to });
  });

  return {
    applySpan,
    readState: (): SyncRow | null => {
      const r = s.readState.get() as (Omit<SyncRow, "chainId"> & { chainId: bigint }) | undefined;
      return r ? { ...r, chainId: Number(r.chainId) } : null;
    },
    writeState: (state: SyncRow) => s.writeState.run(state),
  };
}

export type Store = ReturnType<typeof createStore>;

/** Feed rows older than the window are never written, so a backfill does not flood the feed. */
export const feedFloor = (head: bigint) => (head > FEED_WINDOW_BLOCKS ? head - FEED_WINDOW_BLOCKS : 0n);
