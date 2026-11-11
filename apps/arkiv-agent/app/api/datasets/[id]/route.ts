import { getDataset, liveRecords, recentRecords } from "@arkiv-agent/catalogue";
import { indexNotReady } from "../../../../lib/db";
import { json } from "../../../../lib/json";

export const dynamic = "force-dynamic";

/**
 * A dataset's live numbers and newest records, refetched by the detail page on feed changes.
 * `?records=live` answers with every live record instead (attributes only), for Arkiv-Decode's table.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const notReady = indexNotReady();
  if (notReady) return notReady;
  const { id } = await params;
  const detail = getDataset(id);
  if (!detail) return Response.json({ error: "not found" }, { status: 404 });
  if (new URL(request.url).searchParams.get("records") === "live") return json(request, liveRecords(id), { headers: { "Cache-Control": "no-store" } });
  return json(request, { dataset: detail.dataset, chainHead: detail.chainHead, records: recentRecords(id) }, { headers: { "Cache-Control": "no-store" } });
}
