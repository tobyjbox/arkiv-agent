"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/** Period and load-generator filter, both in the URL. The filter stays in plain sight (design/05). */
export function PulseControls({ period, includeLoad, loadWallets }: { period: number; includeLoad: boolean; loadWallets: number }) {
  const router = useRouter();
  const href = (p: number, load: boolean) => `/insights?period=${p}${load ? "&load=1" : ""}`;
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div role="group" aria-label="Period" className="flex rounded-md border border-border-default p-0.5">
        {[7, 30, 90].map((p) => (
          <Link key={p} href={href(p, includeLoad)} aria-current={p === period ? "page" : undefined}
            className={`rounded-sm px-3 py-1 caption ${p === period ? "bg-raised text-text-primary" : "text-text-secondary hover:text-text-primary"}`}>{p}d</Link>
        ))}
      </div>
      <label className="flex items-center gap-2 caption text-text-secondary"
        title={`${loadWallets} wallets with over 5,000 creates in the last 7 days (Arkiv's load generators) are left out, so they don't drown the totals.`}>
        <input type="checkbox" checked={!includeLoad} onChange={(e) => router.replace(href(period, !e.target.checked), { scroll: false })} className="size-4 accent-[var(--color-accent)]" />
        Exclude load generators
      </label>
    </div>
  );
}
