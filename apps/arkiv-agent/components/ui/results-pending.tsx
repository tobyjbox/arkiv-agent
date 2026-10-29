import { RefreshOnChange } from "../pulse/refresh";

/** Insights and Financials show results the indexer stores after it syncs; this stands in until it first has. */
export function ResultsPending({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-[1280px] space-y-4 px-4 pb-16 pt-8 sm:px-6">
      <RefreshOnChange />
      <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.015em]">{title}</h1>
      <p className="rounded-md border border-border-subtle bg-surface p-5 text-text-secondary">
        The indexer works these numbers out after it syncs, and hasn&apos;t yet. Start it with <code className="font-mono">pnpm index --watch</code> and
        they appear within a minute, or run <code className="font-mono">pnpm aggregates</code> to work them out once.
      </p>
    </div>
  );
}
