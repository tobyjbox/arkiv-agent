import { AskPlanSchema, exampleQuestions, interpretQuestion } from "@arkiv-agent/ask";
import { z } from "zod";
import { askContext, brief, explorerUrl } from "../../../lib/ask";

export const dynamic = "force-dynamic";

const Body = z.object({
  question: z.string().trim().min(1).max(500),
  scope: z.string().max(32).nullish(),
  previous: AskPlanSchema.nullish(),
});

/** Question → interpretation (no chain read yet), so the screen can show it before results arrive. */
export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Expected { question, scope?, previous? }." }, { status: 400 });
  const ctx = askContext(body.data.scope ?? null, body.data.previous ?? null);
  const r = await interpretQuestion(body.data.question, ctx);
  if (!r.ok) return Response.json({ ...r, examples: exampleQuestions(ctx, 2) });
  const d = ctx.datasets.find((x) => x.id === r.plan.datasetId);
  return Response.json({ ...r, dataset: d ? brief(d) : null, explorerUrl: explorerUrl(r.query) });
}
