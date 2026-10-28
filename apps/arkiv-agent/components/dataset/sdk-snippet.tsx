"use client";

import { useState } from "react";
import { CopyButton } from "../ui/copy-button";

/** "Read this dataset": TypeScript and the raw query string, each copyable. */
export function SdkSnippet({ typescript, query }: { typescript: string; query: string }) {
  const [tab, setTab] = useState<"ts" | "query">("ts");
  const text = tab === "ts" ? typescript : query;
  return (
    <section aria-labelledby="read" className="space-y-3">
      <h2 id="read" className="text-[20px] font-semibold">Read this dataset</h2>
      <div className="overflow-hidden rounded-md border border-border-subtle bg-canvas">
        <div className="flex items-center border-b border-border-subtle px-2">
          <div role="tablist" className="flex">
            {(["ts", "query"] as const).map((t) => (
              <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)}
                className={`px-3 py-2 caption ${tab === t ? "text-text-primary shadow-[inset_0_-2px_0_var(--color-accent)]" : "text-text-secondary"}`}>
                {t === "ts" ? "TypeScript" : "Query string"}
              </button>
            ))}
          </div>
          <CopyButton value={text} label="Copy code" className="ml-auto" />
        </div>
        <pre className="overflow-x-auto p-4 mono-sm text-text-primary"><code>{text}</code></pre>
      </div>
    </section>
  );
}
