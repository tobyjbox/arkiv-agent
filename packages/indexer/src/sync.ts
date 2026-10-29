import type { ArkivClient } from "@arkiv-agent/core";
import { FEED_WINDOW_BLOCKS, type IndexStore as Store, type SyncRow } from "@arkiv-agent/db";
import { MAX_SPAN, readEvents } from "./chain.ts";

/** Feed rows older than the window are never written, so a backfill does not flood the feed. */
export const feedFloor = (head: bigint) => (head > FEED_WINDOW_BLOCKS ? head - FEED_WINDOW_BLOCKS : 0n);

/** Index up to head minus this, so a shallow reorg near the tip is not indexed (no reorg handling). */
export const CONFIRMATIONS = 2n;

export type SyncResult = { from: bigint; to: bigint; head: bigint; events: number };
export type Progress = (p: { to: bigint; target: bigint; events: number }) => void;

/** Refuses an index built on another chain: a testnet reset keeps the chain id, not block 0. */
export async function openChain(client: ArkivClient, store: Store): Promise<SyncRow> {
  const [chainId, genesis] = await Promise.all([client.getChainId(), client.getBlock({ blockNumber: 0n })]);
  const state = store.readState();
  if (state && (state.chainId !== chainId || state.genesisHash !== genesis.hash)) {
    throw new Error(`The index at DATABASE_URL belongs to another chain (block 0 ${state.genesisHash}, now ${genesis.hash}). Delete it to rebuild.`);
  }
  if (state) return state;
  const fresh = { chainId, genesisHash: genesis.hash, indexedBlock: 0n, chainHead: 0n, syncedAtMs: BigInt(Date.now()) };
  store.writeState(fresh);
  return fresh;
}

/** Replays entity events from the cursor to the confirmed head. Safe to stop and re-run at any point. */
export async function syncEvents(client: ArkivClient, store: Store, state: SyncRow, onProgress?: Progress): Promise<SyncResult> {
  const head = await client.getBlockNumber();
  const target = head - CONFIRMATIONS;
  const floor = feedFloor(target);
  const from = state.indexedBlock + 1n;
  let events = 0;
  const span = (start: bigint) => readEvents(client, start, start + MAX_SPAN - 1n < target ? start + MAX_SPAN - 1n : target);
  // Fetch the next span while the current one is written.
  let pending = from <= target ? span(from) : null;
  for (let start = from; pending; start += MAX_SPAN) {
    const batch = await pending;
    const to = start + MAX_SPAN - 1n < target ? start + MAX_SPAN - 1n : target;
    pending = to < target ? span(to + 1n) : null;
    store.applySpan(batch, to, floor, { ...state, chainHead: head, syncedAtMs: BigInt(Date.now()) });
    events += batch.length;
    onProgress?.({ to, target, events });
  }
  if (from > target) store.writeState({ ...state, indexedBlock: state.indexedBlock, chainHead: head, syncedAtMs: BigInt(Date.now()) });
  return { from, to: target, head, events };
}
