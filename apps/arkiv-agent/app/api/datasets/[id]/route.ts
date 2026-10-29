import { getDataset, recentRecords } from "@arkiv-agent/catalogue";

export const dynamic = "force-dynamic";

/** A dataset's live numbers and newest records, refetched by the detail page on feed changes. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = getDataset(id);
  if (!detail) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ dataset: detail.dataset, chainHead: detail.chainHead, records: recentRecords(id) }, { headers: { "Cache-Control": "no-store" } });
}
