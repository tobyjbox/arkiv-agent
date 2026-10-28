import { datasetSnippet, getDataset, recentRecords } from "@arkiv-agent/catalogue";
import { AlertTriangle, ExternalLink, Sparkles } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityChart } from "../../../components/dataset/activity-chart";
import { Suspense } from "react";
import { AiSummary, AiSummarySkeleton } from "../../../components/dataset/ai-summary";
import { DatasetLive } from "../../../components/dataset/dataset-live";
import { SchemaTable } from "../../../components/dataset/schema-table";
import { SdkSnippet } from "../../../components/dataset/sdk-snippet";
import { CopyButton } from "../../../components/ui/copy-button";
import { BLOCK_SECONDS, formatCount, middle, percent } from "../../../lib/format";

export const dynamic = "force-dynamic";

export default async function DatasetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = getDataset(id);
  if (!detail) notFound();
  const { dataset: d, chainHead, activity } = detail;
  const live = { dataset: d, chainHead, records: recentRecords(id) };
  const snippet = datasetSnippet(d);
  const isActive = (chainHead - d.lastWriteBlock) * BLOCK_SECONDS < 3_600;
  const project = d.project.method === "label" ? d.project.label : middle(d.project.label);

  return (
    <div className="mx-auto max-w-[1280px] space-y-10 px-4 pb-10 pt-8 sm:px-6">
      <header className="space-y-3">
        <nav aria-label="Breadcrumb" className="caption text-text-tertiary">
          <Link href="/catalogue" className="hover:text-text-primary">← Catalogue</Link> / {project} / {d.name}
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-[28px] font-semibold leading-[34px] tracking-[-0.015em]">{d.name}</h1>
          <span className={`caption rounded-full px-2 py-0.5 ${d.liveCount === 0 ? "tint-warn" : isActive ? "tint-live" : "border border-border-default text-text-secondary"}`}>
            {d.liveCount === 0 ? "All expired" : isActive ? "● Active" : "Quiet"}
          </span>
          <div className="ml-auto flex gap-2">
            <Link href={`/ask?scope=${d.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-ai/40 px-4 text-text-primary hover:bg-raised">
              <Sparkles size={16} className="text-ai" aria-hidden /> Ask about this dataset
            </Link>
            <a href="#read" className="inline-flex h-9 items-center rounded-md bg-accent px-4 font-medium text-on-accent">Copy SDK snippet</a>
            <a href={`https://data.arkiv.network/?q=${encodeURIComponent(snippet.query)}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border-default px-4 text-text-primary hover:bg-raised">
              <ExternalLink size={16} className="text-info" aria-hidden /> Open Data Explorer<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </div>
        <p className="flex flex-wrap items-center gap-2 text-text-secondary">
          <span className={d.project.method === "creator" ? "font-mono" : ""}>{project}</span>
          {d.project.method === "creator" && <CopyButton value={d.project.label} label="Copy wallet address" />}
          <span>· attributed by {d.project.method === "label" ? `the ${d.project.labelAttr} label` : "creator wallet"} · {percent(d.project.confidence)} confidence</span>
          {d.project.conflictWallets && (
            <span className="flex items-center gap-1 text-warn"><AlertTriangle size={14} aria-hidden />label used by {d.project.conflictWallets} unrelated wallets</span>
          )}
        </p>
      </header>

      {d.liveCount === 0 && (
        <p className="rounded-md px-4 py-2.5 tint-warn">All records in this dataset have expired. Showing what ArkivAgent saw last, up to block {formatCount(d.lastWriteBlock)}.</p>
      )}

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-7"><Suspense fallback={<AiSummarySkeleton />}><AiSummary id={d.id} /></Suspense></div>
        <div className="xl:col-span-5"><DatasetLive initial={live} part="stats" /></div>
      </div>

      <section aria-labelledby="schema" className="space-y-3">
        <h2 id="schema" className="text-[20px] font-semibold">Schema</h2>
        <SchemaTable fields={d.schema} />
      </section>

      <ActivityChart writes={activity.writes} expiries={activity.expiries} />

      <section aria-labelledby="recent" className="space-y-3">
        <h2 id="recent" className="text-[20px] font-semibold">Recent records</h2>
        <DatasetLive initial={live} part="records" />
      </section>

      <SdkSnippet typescript={snippet.typescript} query={snippet.query} />
    </div>
  );
}
