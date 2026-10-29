import { AskPlanSchema, compile, runAsk } from "@arkiv-agent/ask";
import { z } from "zod";
import { arkiv, askContext, explorerUrl } from "../../../../lib/ask";
import { indexNotReady } from "../../../../lib/db";
import { refuseCrossSite } from "../../../../lib/guard";

export const dynamic = "force-dynamic";

const Body = z.object({
  plan: AskPlanSchema,
  cursor: z.string().max(4096).nullish(),
  block: z.string().regex(/^\d{1,12}$/).nullish(),
});

/**
 * Runs a plan live on Arkiv, one page. Takes a plan, never a query string: it is validated and
 * compiled here with the SDK builders, so an edited chip can't smuggle in anything else.
 */
export async function POST(request: Request) {
  const refused = refuseCrossSite(request) ?? indexNotReady();
  if (refused) return refused;
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Expected { plan, cursor?, block? }." }, { status: 400 });
  const { plan, cursor, block } = body.data;
  const { datasets } = askContext();
  const d = plan.datasetId ? datasets.find((x) => x.id === plan.datasetId) : null;
  if (d === undefined) return Response.json({ error: "That dataset is no longer in the catalogue." }, { status: 404 });
  const c = compile(plan, d);
  if (!c.ok) return Response.json({ ok: false, kind: "invalid", message: c.error });
  const page = await runAsk(arkiv, c.value.expression, { limit: plan.limit, cursor: cursor ?? null, block: block ?? null });
  const compiled = { query: c.value.query, typescript: c.value.typescript, explorerUrl: explorerUrl(c.value.query) };
  return Response.json(page.ok ? { ok: true, ...compiled, ...page.value } : { ok: false, ...compiled, ...page.error });
}
