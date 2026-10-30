import type { Dataset } from "@arkiv-agent/catalogue";
import { type AskClient, interpretWithClaude } from "./claude.ts";
import { compile } from "./compile.ts";
import { type AskContext, interpret } from "./interpret.ts";
import type { AskPlan } from "./query.ts";

export type Engine = "rules" | "claude";

export type Interpretation =
  | { ok: true; engine: Engine; plan: AskPlan; query: string; typescript: string; note: string | null }
  | { ok: false; engine: Engine; kind: "not-understood" | "invalid" | "refused"; message: string };

export const hasAskKey = () => Boolean(process.env.ANTHROPIC_API_KEY);

/** Validates and compiles a plan from either engine, or from an edited chip. Nothing runs uncompiled. */
export function finish(plan: AskPlan, datasets: Dataset[], engine: Engine, note: string | null = null): Interpretation {
  const dataset = plan.datasetId ? datasets.find((d) => d.id === plan.datasetId) : null;
  if (dataset === undefined) return { ok: false, engine, kind: "invalid", message: "That dataset is no longer in the catalogue." };
  const c = compile(plan, dataset);
  if (!c.ok) return { ok: false, engine, kind: "invalid", message: c.error };
  return { ok: true, engine, plan, query: c.value.query, typescript: c.value.typescript, note };
}

/**
 * Question to plan. With ANTHROPIC_API_KEY (or an injected client) Claude interprets it; without,
 * the catalogue rules do. If Claude can't be reached, the rules answer and the note says so.
 */
export async function interpretQuestion(question: string, ctx: AskContext, opts: { client?: AskClient } = {}): Promise<Interpretation> {
  if (opts.client || hasAskKey()) {
    try {
      const r = await interpretWithClaude(question, ctx, opts.client);
      if (!r.ok) return { ok: false, engine: "claude", ...r.error };
      return finish(r.value, ctx.datasets, "claude");
    } catch {
      const r = interpret(question, ctx);
      const note = "Claude couldn't be reached, so the catalogue rules answered.";
      return r.ok ? finish(r.value, ctx.datasets, "rules", note) : { ok: false, engine: "rules", ...r.error };
    }
  }
  const r = interpret(question, ctx);
  return r.ok ? finish(r.value, ctx.datasets, "rules") : { ok: false, engine: "rules", ...r.error };
}
