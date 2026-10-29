import type { Sqlite } from "./sqlite.ts";

/** Marks an entity whose calldata did not decode as expected, so it is not retried forever. */
const UNDECODABLE = -1n;

export type PendingDecode = { key: string; createdTx: string; createdOp: number; createdAtBlock: bigint };
export type PatchRef = { tx: string; op: number; block: bigint };
/** What decoding found for one entity. */
export type Decoded = {
  attrs: Iterable<[string, { type: string; value: string }]>; contentType: string | null;
  schemaSig: string; payloadBytes: number | null; payloadPreview: string | null;
};

/**
 * The attribute decoder's reads and writes. Which entities wait: live ones (all but the load
 * generators in `busy`, which get the keys ending in 0, 1 in 16) and those created at or after
 * `sinceBlock` by anyone else; an entity patched more than `redecodeAfterBlocks` after its last decode
 * waits again.
 */
export function createDecodeStore(db: Sqlite, redecodeAfterBlocks: number) {
  const waiting = `((status = 'live' AND (key LIKE '%0' OR owner NOT IN (SELECT value FROM json_each(@busy))))
        OR (createdAtBlock >= @sinceBlock AND owner NOT IN (SELECT value FROM json_each(@busy))))
      AND (decodedBlock IS NULL OR (decodedBlock <> -1 AND EXISTS (SELECT 1 FROM "Patch" p WHERE p.entityKey = e.key AND p.block > e.decodedBlock + ${redecodeAfterBlocks})))`;
  const pending = db.prepare(`SELECT key, createdTx, createdOp, createdAtBlock FROM "Entity" e
    WHERE ${waiting}
    ORDER BY status = 'live' DESC, createdAtBlock DESC LIMIT @limit`).safeIntegers();
  const countPending = db.prepare(`SELECT COUNT(*) AS n FROM "Entity" e
    WHERE ${waiting}`);
  const patches = db.prepare(`SELECT tx, op, block FROM "Patch" WHERE entityKey = ? ORDER BY block, logIndex`).safeIntegers();
  const clear = db.prepare(`DELETE FROM "Attribute" WHERE entityKey = ?`);
  const insert = db.prepare(`INSERT INTO "Attribute" (entityKey, name, type, value) VALUES (?, ?, ?, ?)`);
  const finish = db.prepare(`UPDATE "Entity" SET contentType = @contentType, payloadBytes = @payloadBytes,
    payloadPreview = @payloadPreview, schemaSig = @schemaSig, decodedBlock = @decodedBlock WHERE key = @key`);
  const fail = db.prepare(`UPDATE "Entity" SET decodedBlock = ${UNDECODABLE} WHERE key = ?`);
  const announce = db.prepare(`INSERT OR IGNORE INTO "Change" (block, kind, entityKey, owner) SELECT @decodedBlock, 'decoded', key, owner FROM "Entity" WHERE key = @key`);

  /** Replaces an entity's attributes and decode result; tells the UI when it's within the feed window. */
  const write = db.transaction((key: string, d: Decoded, decodedBlock: bigint, feedFloor: bigint) => {
    clear.run(key);
    for (const [name, a] of d.attrs) insert.run(key, name, a.type, a.value);
    finish.run({ key, decodedBlock, contentType: d.contentType, schemaSig: d.schemaSig, payloadBytes: d.payloadBytes, payloadPreview: d.payloadPreview });
    // Attributes land after their block was indexed; tell the UI so a fresh row can fill in.
    if (decodedBlock > feedFloor) announce.run({ key, decodedBlock });
  });

  return {
    pending: (sinceBlock: bigint, limit: number, busyJson: string) => pending.all({ sinceBlock, limit, busy: busyJson }) as PendingDecode[],
    countPending: (sinceBlock: bigint, busyJson: string) => Number((countPending.get({ sinceBlock, busy: busyJson }) as { n: number }).n),
    patchRefs: (key: string) => patches.all(key) as PatchRef[],
    write,
    markUndecodable: (key: string) => { fail.run(key); },
  };
}
