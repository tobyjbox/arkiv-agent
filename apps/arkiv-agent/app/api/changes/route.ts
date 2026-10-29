import { readFeed } from "@arkiv-agent/db";
import { indexNotReady, prisma } from "../../../lib/db";

// Change feed for the "feels live" UI (design/02-feels-live.md): poll every 5 s with the last
// `cursor`; no `since` (or a stale one) returns `reset: true` and a fresh cursor.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("since");
  if (raw !== null && !/^\d{1,15}$/.test(raw)) {
    return Response.json({ error: "since must be a cursor returned by this endpoint" }, { status: 400 });
  }
  const notReady = indexNotReady();
  if (notReady) return notReady;
  const feed = await readFeed(prisma, raw === null ? null : Number(raw));
  return Response.json(feed, { headers: { "Cache-Control": "no-store" } });
}
