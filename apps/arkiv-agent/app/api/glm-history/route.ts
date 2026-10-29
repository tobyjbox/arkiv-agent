import { glmHistory, RANGES, type RangeDays } from "../../../lib/glm-history";

export const dynamic = "force-dynamic";

/** GLM/USD candles for the price chart on /financials. The page loads without them and fetches these after. */
export async function GET(request: Request) {
  const days = Number(new URL(request.url).searchParams.get("days") ?? 30);
  if (!(days in RANGES)) return Response.json({ error: "days must be 7, 30 or 90" }, { status: 400 });
  if (process.env.GLM_PRICE === "off") return Response.json({ error: "GLM price lookups are off (GLM_PRICE=off)." }, { status: 503 });
  const history = await glmHistory(days as RangeDays);
  if (!history) return Response.json({ error: "No GLM price history is available right now." }, { status: 503 });
  return Response.json(history, { headers: { "Cache-Control": "no-store" } });
}
