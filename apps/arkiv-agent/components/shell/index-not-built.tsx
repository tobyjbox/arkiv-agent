import type { IndexStatus } from "@arkiv-agent/db";
import { Diamond } from "lucide-react";

/** Shown in place of every page until `pnpm index` has created the index (T21 M2). */
export function IndexNotBuilt({ status }: { status: Exclude<IndexStatus, "ready"> }) {
  return (
    <main id="main" className="mx-auto max-w-[720px] space-y-4 px-4 py-16 sm:px-6">
      <div className="flex items-center gap-2 font-semibold text-text-primary">
        <Diamond size={18} className="text-accent" aria-hidden /> ArkivAgent
      </div>
      <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.015em]">The index isn&apos;t built yet</h1>
      <p className="text-text-secondary">
        {status === "missing"
          ? "ArkivAgent reads Arkiv through a local index, and there isn't one yet."
          : "The index file is there, but the first pnpm index hasn't finished setting it up."}{" "}
        Run the indexer in another terminal, then reload this page:
      </p>
      <pre className="rounded-md border border-border-subtle bg-canvas p-4 mono-sm text-text-primary"><code>pnpm index --watch</code></pre>
      <p className="caption text-text-tertiary">
        The first run replays Arkiv from block 1 (about 4 minutes). Pages work as soon as it has started; the catalogue fills in
        as records are decoded.
      </p>
    </main>
  );
}
