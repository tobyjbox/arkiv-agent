import { getDataset, LIVE_RECORDS_MAX, liveRecords, recentRecords } from "@arkiv-agent/catalogue";
import { indexNotReady } from "../../../../lib/db";
import { json } from "../../../../lib/json";

export const dynamic = "force-dynamic";

/**
 * A dataset's live numbers and newest records, refetched by the detail page on feed changes.
 * `?records=live` answers with the live records instead, a page at a time (attributes only), for Arkiv-Decode's table.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const notReady = indexNotReady();
  if (notReady) return notReady;
  const { id } = await params;
  const detail = getDataset(id);
  if (!detail) return Response.json({ error: "not found" }, { status: 404 });
  const q = new URL(request.url).searchParams;
  if (q.get("records") === "live") {
    // Read in pages (`offset`, `limit`), so the table can show how far it has got on a large dataset.
    const whole = (name: string, fallback: number) => { const n = Number(q.get(name)); return Number.isInteger(n) && n >= 0 ? n : fallback; };
    const offset = Math.min(whole("offset", 0), LIVE_RECORDS_MAX);
    const limit = Math.min(whole("limit", LIVE_RECORDS_MAX), LIVE_RECORDS_MAX - offset);
    return json(request, liveRecords(id, limit, offset), { headers: { "Cache-Control": "no-store" } });
  }
  return json(request, { dataset: detail.dataset, chainHead: detail.chainHead, records: recentRecords(id) }, { headers: { "Cache-Control": "no-store" } });
}
