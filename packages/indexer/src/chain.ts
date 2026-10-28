import { ENTITY_EVENTS_ABI } from "@arkiv-network/sdk";
import { ARKIV_ADDRESS, type ArkivClient } from "@arkiv-agent/core";
import type { Hex } from "viem";

/** Blocks per `eth_getLogs` call. The node also caps a call at 20,000 results; see `readEvents`. */
export const MAX_SPAN = 5_000n;

type Base = { block: bigint; logIndex: number; tx: Hex; op: number; key: Hex };

/** One entity event, normalized. `op` is its position among its transaction's entity events. */
export type EntityEvent =
  | (Base & { kind: "created"; owner: Hex; expiresAt: bigint; flags: number })
  | (Base & { kind: "patched"; owner: Hex })
  | (Base & { kind: "extended"; owner: Hex; expiresAt: bigint })
  | (Base & { kind: "transferred"; owner: Hex })
  | (Base & { kind: "deleted"; owner: Hex });

type RawLog = Awaited<ReturnType<typeof fetchRaw>>[number];

const fetchRaw = (client: ArkivClient, fromBlock: bigint, toBlock: bigint) =>
  client.getLogs({ address: ARKIV_ADDRESS, events: ENTITY_EVENTS_ABI, fromBlock, toBlock, strict: true });

function normalize(log: RawLog, op: number): EntityEvent {
  const base = { block: log.blockNumber, logIndex: log.logIndex, tx: log.transactionHash, op, key: log.args.entityKey };
  switch (log.eventName) {
    case "EntityCreated":
      return { ...base, kind: "created", owner: log.args.owner, expiresAt: log.args.expiresAt, flags: log.args.creationFlags };
    case "EntityPatched":
      return { ...base, kind: "patched", owner: log.args.owner };
    case "ExpiryExtended":
      return { ...base, kind: "extended", owner: log.args.owner, expiresAt: log.args.expiresAt };
    case "OwnershipTransferred":
      return { ...base, kind: "transferred", owner: log.args.newOwner };
    case "EntityDeleted":
      return { ...base, kind: "deleted", owner: log.args.owner };
  }
}

/** Entity events in [from, to], in chain order, each tagged with its operation position. */
export function toEvents(logs: readonly RawLog[]): EntityEvent[] {
  const sorted = [...logs].sort((a, b) => (a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1));
  const seen = new Map<Hex, number>();
  return sorted.map((log) => {
    const op = seen.get(log.transactionHash) ?? 0;
    seen.set(log.transactionHash, op + 1);
    return normalize(log, op);
  });
}

/** The node's "query exceeds max results 20000, retry with the range A-B" error, if this is one. */
export function suggestedEnd(error: unknown, from: bigint, to: bigint): bigint | null {
  const text = error instanceof Error ? `${error.message} ${String((error as { cause?: { message?: string } }).cause?.message ?? "")}` : String(error);
  if (!/exceeds max results/.test(text) || from >= to) return null;
  const end = /retry with the range \d+-(\d+)/.exec(text)?.[1];
  const hinted = end ? BigInt(end) : null;
  return hinted !== null && hinted >= from && hinted < to ? hinted : from + (to - from) / 2n;
}

/** Events in [from, to]. A span over the node's result cap is split, at block boundaries, and retried. */
export async function readEvents(client: ArkivClient, from: bigint, to: bigint): Promise<EntityEvent[]> {
  try {
    return toEvents(await fetchRaw(client, from, to));
  } catch (error) {
    const mid = suggestedEnd(error, from, to);
    if (mid === null) throw error;
    return [...(await readEvents(client, from, mid)), ...(await readEvents(client, mid + 1n, to))];
  }
}

export type { RawLog };
