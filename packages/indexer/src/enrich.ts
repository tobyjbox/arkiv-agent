import type { Sqlite } from "@arkiv-agent/db";
import type { Hex } from "viem";
import { applyWire, emptyState, type EntityState, payloadPreview, schemaSig } from "./attributes.ts";
import { type DecodedOp, decodeOps } from "./calldata.ts";

/** Fetches a transaction's calldata. Injected so tests run on recorded fixtures. */
export type InputSource = (tx: Hex) => Promise<Hex>;

/** Marks an entity whose calldata did not decode as expected, so it is not retried forever. */
const UNDECODABLE = -1n;

type Pending = { key: Hex; createdTx: Hex; createdOp: number; createdAtBlock: bigint };
type PatchRef = { tx: Hex; op: number; block: bigint };

/** Over this many creates since `sinceBlock`, an owner is high-volume (Arkiv's load generators). */
export const BUSY_OWNER_CREATES = 5_000;

/**
 * Which entities get attributes: live ones, plus recent history (created at or after `sinceBlock`),
 * from owners that are not high-volume. High-volume owners (load generators, random schemas) get a
 * 1-in-16 sample of their live entities, by key. Everything else keeps its lifecycle only: decoding
 * a week of load-generator writes would take ~12 h at the public rate limit.
 */
export function createEnricher(db: Sqlite, source: InputSource, { busyCreates = BUSY_OWNER_CREATES } = {}) {
  const busyOwners = db.prepare(`SELECT owner FROM "Entity" WHERE createdAtBlock >= ? GROUP BY owner HAVING COUNT(*) > ?`).pluck();
  const pending = db.prepare(`SELECT key, createdTx, createdOp, createdAtBlock FROM "Entity" e
    WHERE ((status = 'live' AND (key LIKE '%0' OR owner NOT IN (SELECT value FROM json_each(@busy))))
        OR (createdAtBlock >= @sinceBlock AND owner NOT IN (SELECT value FROM json_each(@busy))))
      AND (decodedBlock IS NULL OR (decodedBlock <> -1 AND EXISTS (SELECT 1 FROM "Patch" p WHERE p.entityKey = e.key AND p.block > e.decodedBlock)))
    ORDER BY status = 'live' DESC, createdAtBlock DESC LIMIT @limit`).safeIntegers();
  const countPending = db.prepare(`SELECT COUNT(*) AS n FROM "Entity" e
    WHERE ((status = 'live' AND (key LIKE '%0' OR owner NOT IN (SELECT value FROM json_each(@busy))))
        OR (createdAtBlock >= @sinceBlock AND owner NOT IN (SELECT value FROM json_each(@busy))))
      AND (decodedBlock IS NULL OR (decodedBlock <> -1 AND EXISTS (SELECT 1 FROM "Patch" p WHERE p.entityKey = e.key AND p.block > e.decodedBlock)))`);
  const patches = db.prepare(`SELECT tx, op, block FROM "Patch" WHERE entityKey = ? ORDER BY block, logIndex`).safeIntegers();
  const clear = db.prepare(`DELETE FROM "Attribute" WHERE entityKey = ?`);
  const insert = db.prepare(`INSERT INTO "Attribute" (entityKey, name, type, value) VALUES (?, ?, ?, ?)`);
  const finish = db.prepare(`UPDATE "Entity" SET contentType = @contentType, payloadBytes = @payloadBytes,
    payloadPreview = @payloadPreview, schemaSig = @schemaSig, decodedBlock = @decodedBlock WHERE key = @key`);
  const fail = db.prepare(`UPDATE "Entity" SET decodedBlock = ${UNDECODABLE} WHERE key = ?`);
  const announce = db.prepare(`INSERT OR IGNORE INTO "Change" (block, kind, entityKey, owner) SELECT @decodedBlock, 'decoded', key, owner FROM "Entity" WHERE key = @key`);

  const write = db.transaction((key: Hex, state: EntityState, decodedBlock: bigint, feedFloor: bigint) => {
    clear.run(key);
    for (const [name, a] of state.attrs) insert.run(key, name, a.type, a.value);
    finish.run({
      key, decodedBlock, contentType: state.contentType, schemaSig: schemaSig(state.attrs),
      payloadBytes: state.payload?.length ?? null, payloadPreview: state.payload ? payloadPreview(state.payload) : null,
    });
    // Attributes land after their block was indexed; tell the UI so a fresh row can fill in.
    if (decodedBlock > feedFloor) announce.run({ key, decodedBlock });
  });

  const busy = (sinceBlock: bigint) => JSON.stringify(busyOwners.all(sinceBlock, busyCreates));

  /** Decodes up to `limit` entities; returns how many were written and how many failed. */
  async function run(sinceBlock: bigint, limit: number, feedFloor: bigint) {
    const batch = pending.all({ sinceBlock, limit, busy: busy(sinceBlock) }) as Pending[];
    const refs = new Map(batch.map((e) => [e.key, patches.all(e.key) as PatchRef[]]));
    const txs = new Set<Hex>(batch.flatMap((e) => [e.createdTx, ...refs.get(e.key)!.map((p) => p.tx)]));
    const ops = new Map<Hex, DecodedOp[]>();
    await Promise.all([...txs].map(async (tx) => ops.set(tx, decodeOps(await source(tx)))));

    let written = 0, failed = 0;
    for (const e of batch) {
      const create = ops.get(e.createdTx)?.[e.createdOp];
      if (create?.kind !== "create") { fail.run(e.key); failed++; continue; }
      const state = applyWire(emptyState(), create.attributes);
      let decodedBlock = e.createdAtBlock;
      for (const p of refs.get(e.key)!) {
        const op = ops.get(p.tx)?.[p.op];
        if (op?.kind === "patch" && op.entityKey.toLowerCase() === e.key.toLowerCase()) applyWire(state, op.mutations);
        decodedBlock = p.block;
      }
      write(e.key, state, decodedBlock, feedFloor);
      written++;
    }
    return { written, failed, txs: txs.size };
  }

  return { run, pendingCount: (sinceBlock: bigint) => Number((countPending.get({ sinceBlock, busy: busy(sinceBlock) }) as { n: number }).n) };
}

/** Spaces calls to stay under a requests-per-second budget (the public RPC allows 600/min). */
export function rateLimited<A extends unknown[], R>(fn: (...a: A) => Promise<R>, perSecond: number) {
  const gap = 1_000 / perSecond;
  let next = 0;
  return async (...args: A): Promise<R> => {
    const now = Date.now();
    const at = Math.max(now, next);
    next = at + gap;
    if (at > now) await new Promise((r) => setTimeout(r, at - now));
    return fn(...args);
  };
}
