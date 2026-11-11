import { recordDetail } from "@arkiv-agent/db";
import { indexNotReady } from "../../../../lib/db";
import { json } from "../../../../lib/json";

export const dynamic = "force-dynamic";

/** One record as the index holds it, with its create transaction, for Arkiv-Decode's record window. */
export async function GET(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const notReady = indexNotReady();
  if (notReady) return notReady;
  const { key } = await params;
  const detail = /^0x[0-9a-fA-F]{64}$/.test(key) ? recordDetail(key) : null;
  if (!detail) return Response.json({ error: "not found" }, { status: 404 });
  return json(request, detail, { headers: { "Cache-Control": "no-store" } });
}
