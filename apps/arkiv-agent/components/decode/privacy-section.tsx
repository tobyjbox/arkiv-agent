"use client";

import type { Decode } from "@arkiv-agent/decode";
import { formatCount, middle } from "../../lib/format";

/** Datasets whose attribute names suggest personal data, most categories and most records first. */
export function PrivacySection({ decode, onSelect }: { decode: Decode; onSelect: (id: string) => void }) {
  const rows = decode.projects.flatMap((p) => p.datasets.filter((d) => d.flags.length).map((d) => ({ p, d })))
    .sort((a, b) => b.d.flags.length - a.d.flags.length || b.d.live - a.d.live).slice(0, 20);
  return (
    <section aria-labelledby="privacy" className="space-y-3">
      <div>
        <h2 id="privacy" className="text-[20px] font-semibold">Privacy radar</h2>
        <p className="text-text-secondary">Everything on Arkiv is public. These datasets have attribute names that suggest personal data. Only the names were checked, never the values, so treat each as a prompt to look, not a finding.</p>
      </div>
      {rows.length === 0 ? <p className="rounded-md border border-border-subtle bg-surface p-4 text-text-secondary">No attribute names matched.</p> : (
        <div className="overflow-x-auto rounded-md border border-border-subtle bg-surface">
          <table className="w-full text-left">
            <thead className="caption text-text-tertiary"><tr className="border-b border-border-subtle"><th scope="col" className="px-4 py-2 font-medium">Dataset</th><th scope="col" className="px-3 py-2 font-medium">Project</th><th scope="col" className="px-3 py-2 text-right font-medium">Live</th><th scope="col" className="px-3 py-2 font-medium">Suggested by</th></tr></thead>
            <tbody>
              {rows.map(({ p, d }) => (
                <tr key={d.id} className="border-b border-border-subtle align-top last:border-0">
                  <td className="max-w-[26ch] truncate px-4 py-2"><a href={`/catalogue/${d.id}`} className="mono-sm hover:underline">{d.name}</a></td>
                  <td className="max-w-[22ch] truncate px-3 py-2"><button type="button" onClick={() => onSelect(p.id)} className="mono-sm text-text-secondary hover:text-text-primary hover:underline">{p.isLabel ? p.label : middle(p.label)}</button></td>
                  <td className="px-3 py-2 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>{formatCount(d.live)}</td>
                  <td className="px-3 py-2 caption">
                    {d.flags.map((f) => <span key={f.category} className="mb-1 mr-1.5 inline-block rounded-sm px-1.5 py-0.5 tint-warn">{f.category}: <span className="font-mono">{f.fields.join(", ")}</span></span>)}
                    {d.isSealed && <span className="text-text-tertiary">payload encrypted</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
