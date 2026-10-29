import { busyOwners, createDecodeStore, type PatchRef, type PendingDecode, type Sqlite } from "@arkiv-agent/db";
import type { Hex } from "viem";
import { applyWire, emptyState, type EntityState, payloadPreview, schemaSig } from "./attributes.ts";
import { type DecodedOp, decodeOps } from "./calldata.ts";

/** Fetches a transaction's calldata. Injected so tests run on recorded fixtures. */
export type InputSource = (tx: Hex) => Promise<Hex>;
/** Reads an entity's current state from the chain (one `arkiv_query`), or null when it is gone. */
export type CurrentSource = (key: Hex) => Promise<EntityState | null>;

/** Above this many patches, replaying calldata costs more than one live read (some entities have thousands). */
export const MAX_REPLAY_PATCHES = 25;
/** Re-decode a patched entity at most this many blocks (~5 min) after its last decode. */
const REDECODE_AFTER_BLOCKS = 150;
const BUSY_TTL_MS = 5 * 60_000;

type Pending = PendingDecode & { key: Hex; createdTx: Hex };

/** Over this many creates since `sinceBlock`, an owner is high-volume (Arkiv's load generators). */
export const BUSY_OWNER_CREATES = 5_000;

/**
 * Which entities get attributes: live ones, plus recent history (created at or after `sinceBlock`),
 * from owners that are not high-volume. High-volume owners (load generators, random schemas) get a
 * 1-in-16 sample of their live entities, by key. Everything else keeps its lifecycle only: decoding
 * a week of load-generator writes would take ~12 h at the public rate limit.
 */
export function createEnricher(db: Sqlite, source: InputSource, { busyCreates = BUSY_OWNER_CREATES, current }: { busyCreates?: number; current?: CurrentSource } = {}) {
  const store = createDecodeStore(db, REDECODE_AFTER_BLOCKS);
  const write = (key: Hex, state: EntityState, decodedBlock: bigint, feedFloor: bigint) => store.write(key, {
    attrs: state.attrs, contentType: state.contentType, schemaSig: schemaSig(state.attrs),
    payloadBytes: state.payload?.length ?? null, payloadPreview: state.payload ? payloadPreview(state.payload) : null,
  }, decodedBlock, feedFloor);

  let busyCache: { at: number; json: string } | null = null;
  const busy = (sinceBlock: bigint) => {
    if (!busyCache || Date.now() - busyCache.at > BUSY_TTL_MS) busyCache = { at: Date.now(), json: JSON.stringify(busyOwners(sinceBlock, busyCreates, db)) };
    return busyCache.json;
  };

  /** Decodes up to `limit` entities; returns how many were written and how many failed. */
  async function run(sinceBlock: bigint, limit: number, feedFloor: bigint) {
    const batch = store.pending(sinceBlock, limit, busy(sinceBlock)) as Pending[];
    const refs = new Map(batch.map((e) => [e.key, store.patchRefs(e.key) as (PatchRef & { tx: Hex })[]]));
    const isHeavy = (key: Hex) => refs.get(key)!.length > MAX_REPLAY_PATCHES;
    const txs = new Set<Hex>(batch.flatMap((e) => [e.createdTx, ...(isHeavy(e.key) ? [] : refs.get(e.key)!.map((p) => p.tx))]));
    const ops = new Map<Hex, DecodedOp[]>();
    await Promise.all([...txs].map(async (tx) => ops.set(tx, decodeOps(await source(tx)))));

    let written = 0, failed = 0;
    for (const e of batch) {
      const create = ops.get(e.createdTx)?.[e.createdOp];
      if (create?.kind !== "create") { store.markUndecodable(e.key); failed++; continue; }
      const ps = refs.get(e.key)!;
      const decodedBlock = ps.at(-1)?.block ?? e.createdAtBlock;
      // Heavily patched: read the current state once (falls back to the create's attributes).
      let state = isHeavy(e.key) && current ? await current(e.key) : null;
      if (!state) {
        state = applyWire(emptyState(), create.attributes);
        // Heavy and unreadable (e.g. expired): keep the create's attributes rather than retry forever.
        if (!isHeavy(e.key)) {
          for (const p of ps) {
            const op = ops.get(p.tx)?.[p.op];
            if (op?.kind === "patch" && op.entityKey.toLowerCase() === e.key.toLowerCase()) applyWire(state, op.mutations);
          }
        }
      }
      write(e.key, state, decodedBlock, feedFloor);
      written++;
    }
    return { written, failed, txs: txs.size };
  }

  return { run, pendingCount: (sinceBlock: bigint) => store.countPending(sinceBlock, busy(sinceBlock)) };
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
