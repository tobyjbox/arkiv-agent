import { BLOCKS_PER_HOUR, hourlySeries, type Member } from "./build.ts";
import { catalogueDb, loadCatalogue } from "./load.ts";
import type { Dataset } from "./types.ts";

export type RecordView = {
  key: string; owner: string; status: Member["status"]; createdAtBlock: number; expiresAt: number | null;
  attributes: { name: string; value: string }[]; payloadPreview: string | null;
};

export type DatasetDetail = {
  dataset: Dataset; indexedBlock: number; chainHead: number;
  /** Per hour over the decoded history window (7 days), oldest first. */
  activity: { writes: number[]; expiries: number[] };
};

export function getDataset(id: string): DatasetDetail | null {
  const c = loadCatalogue();
  const dataset = c.datasets.find((d) => d.id === id);
  const members = c.membersById.get(id);
  if (!dataset || !members) return null;
  const now = c.summary.indexedBlock;
  const expiries = members.flatMap((m) => (m.expiresAt !== null && m.expiresAt <= now ? [m.expiresAt] : []));
  return {
    dataset, indexedBlock: now, chainHead: c.summary.chainHead,
    activity: { writes: hourlySeries(members.map((m) => m.createdAtBlock), now, 168), expiries: hourlySeries(expiries, now, 168) },
  };
}

/** The newest records, live ones first, with a short payload preview (privacy: never the whole payload). */
export function recentRecords(id: string, limit = 20): RecordView[] {
  const members = loadCatalogue().membersById.get(id) ?? [];
  const newest = [...members].sort((a, b) => Number(b.status === "live") - Number(a.status === "live") || b.createdAtBlock - a.createdAtBlock).slice(0, limit);
  const preview = catalogueDb().prepare(`SELECT payloadPreview FROM "Entity" WHERE key = ?`).pluck();
  return newest.map((m) => ({
    key: m.key, owner: m.owner, status: m.status, createdAtBlock: m.createdAtBlock, expiresAt: m.expiresAt,
    attributes: [...m.attrs].map(([name, a]) => ({ name, value: a.value })),
    payloadPreview: ((preview.get(m.key) as string | null) ?? null)?.slice(0, 120) ?? null,
  }));
}

export { BLOCKS_PER_HOUR };
