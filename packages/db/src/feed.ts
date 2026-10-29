import type { Prisma } from "./prisma.ts";

/** Feed rows kept behind the indexed block (~1 h of 2 s blocks); older cursors get `reset`. */
export const FEED_WINDOW_BLOCKS = 1_800n;
/** Above this many changes since a cursor, the client should re-render instead of animating. */
export const FEED_MAX_CHANGES = 2_000;
/** "Index N blocks behind" shows above this lag (30 s of 2 s blocks). */
export const LAG_WARN_BLOCKS = 15n;

/** `decoded`: an entity's attributes arrived (they are decoded after its block is indexed). */
export type ChangeKind = "created" | "patched" | "extended" | "transferred" | "deleted" | "expired" | "decoded";

export type FeedResponse = {
  /** Opaque: pass it back as `since`. The sequence number of the last change returned. */
  cursor: string;
  indexedBlock: string;
  chainHead: string;
  lagBlocks: string;
  isBehind: boolean;
  syncedAt: string | null;
  liveCount: number;
  /** Live records whose attributes aren't decoded yet (the catalogue's decode progress bar, design/07). */
  undecodedLive: number;
  /** True when `since` is missing, older than the feed window, or too much changed: refetch page data. */
  reset: boolean;
  changes: { seq: number; block: string; kind: ChangeKind; entityKey: string; owner: string }[];
};

/** Changes after cursor `since`, plus the numbers every page header needs. */
export async function readFeed(prisma: Prisma, since: number | null): Promise<FeedResponse> {
  const [state, liveCount, undecodedLive, bounds] = await Promise.all([
    prisma.syncState.findUnique({ where: { id: 1 } }),
    prisma.entity.count({ where: { status: "live" } }),
    prisma.entity.count({ where: { status: "live", decodedBlock: null } }),
    prisma.change.aggregate({ _min: { seq: true }, _max: { seq: true } }),
  ]);
  const indexed = state?.indexedBlock ?? 0n;
  const head = state?.chainHead ?? 0n;
  const lag = head > indexed ? head - indexed : 0n;
  const maxSeq = bounds._max.seq ?? 0;
  const base = {
    indexedBlock: indexed.toString(), chainHead: head.toString(), lagBlocks: lag.toString(), isBehind: lag > LAG_WARN_BLOCKS,
    syncedAt: state ? new Date(Number(state.syncedAtMs)).toISOString() : null, liveCount, undecodedLive,
  };
  const reset = { ...base, cursor: String(maxSeq), reset: true, changes: [] };
  if (since === null || since > maxSeq) return reset;
  if (since === maxSeq) return { ...base, cursor: String(maxSeq), reset: false, changes: [] };
  if (since < (bounds._min.seq ?? 0) - 1) return reset;

  const rows = await prisma.change.findMany({ where: { seq: { gt: since } }, orderBy: { seq: "asc" }, take: FEED_MAX_CHANGES + 1 });
  if (rows.length > FEED_MAX_CHANGES) return reset;
  return {
    ...base, cursor: String(rows.at(-1)?.seq ?? since), reset: false,
    changes: rows.map((r) => ({ seq: r.seq, block: r.block.toString(), kind: r.kind as ChangeKind, entityKey: r.entityKey, owner: r.owner })),
  };
}
