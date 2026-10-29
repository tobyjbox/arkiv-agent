import { exampleQuestions, hasAskKey } from "@arkiv-agent/ask";
import { AskView } from "../../components/ask/ask-view";
import { askContext } from "../../lib/ask";
import { isIndexReady } from "../../lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ask Arkiv · ArkivAgent" };

const SCOPE_OPTIONS = 40;

export default async function AskPage({ searchParams }: { searchParams: Promise<{ scope?: string; q?: string }> }) {
  if (!isIndexReady()) return null;
  const { scope, q } = await searchParams;
  const ctx = askContext();
  const label = (d: (typeof ctx.datasets)[number]) => `${d.project.method === "label" ? d.project.label : `${d.project.label.slice(0, 8)}…`} / ${d.name}`;
  const top = ctx.datasets.filter((d) => !d.isLoadGenerator).sort((a, b) => b.liveCount - a.liveCount).slice(0, SCOPE_OPTIONS);
  const scoped = scope ? ctx.datasets.find((d) => d.id === scope) : undefined;
  const scopes = [...(scoped && !top.includes(scoped) ? [scoped] : []), ...top].map((d) => ({ id: d.id, label: label(d) }));

  return (
    <div className="hero-glow">
      <div className="mx-auto max-w-[1280px] space-y-8 px-4 pb-16 pt-10 sm:px-6">
        <header className="space-y-2 text-center">
          <h1 className="text-[32px] font-semibold leading-[40px] tracking-[-0.02em]">Ask Arkiv</h1>
          <p className="text-text-secondary">Ask in plain English. See the query, the results, and the code.</p>
        </header>
        <AskView examples={exampleQuestions(ctx)} scopes={scopes} initialScope={scoped?.id ?? null} initialQuestion={q?.slice(0, 500) ?? null} engine={hasAskKey() ? "claude" : "rules"} />
      </div>
    </div>
  );
}
