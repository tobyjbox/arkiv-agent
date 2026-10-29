import type { GlmPrice, Spend } from "@arkiv-agent/cost";
import { formatCount } from "../../lib/format";
import { glm, usd } from "../../lib/glm";

/** Estimated spend per project, with each project's share of the total as a bar. */
export function SpendTable({ spend, price }: { spend: Spend; price: GlmPrice | null }) {
  const $ = (x: number) => (price ? usd(x * price.usd) : null);
  return (
    <div className="overflow-x-auto rounded-md border border-border-subtle bg-surface">
      <table className="w-full text-left">
        <thead className="caption text-text-tertiary"><tr className="border-b border-border-subtle">
          <th scope="col" className="px-4 py-2 font-medium">Project</th><th scope="col" className="px-3 py-2 text-right font-medium">GLM (est.)</th>{price && <th scope="col" className="px-3 py-2 text-right font-medium">USD (est.)</th>}
          <th scope="col" className="px-3 py-2 font-medium">Share</th><th scope="col" className="px-3 py-2 text-right font-medium">Writes</th><th scope="col" className="px-3 py-2 text-right font-medium">GLM per write</th>
        </tr></thead>
        <tbody>{spend.projects.map((p) => (
          <tr key={p.project} className="border-b border-border-subtle last:border-0">
            <td className="max-w-[28ch] truncate px-4 py-2">{p.isLabel ? <a href={`/catalogue?q=${encodeURIComponent(p.project)}`} className="font-mono text-[13px] hover:underline">{p.project}</a> : <span className="font-mono text-[13px] text-text-secondary">{`${p.project.slice(0, 8)}…${p.project.slice(-4)}`}</span>}</td>
            <td className="px-3 py-2 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>{glm(p.glm)}</td>
            {price && <td className="px-3 py-2 text-right text-text-secondary" style={{ fontVariantNumeric: "tabular-nums" }}>{$(p.glm)}</td>}
            <td className="px-3 py-2"><span className="block h-1.5 w-[60px] rounded-full bg-raised"><span className="block h-1.5 rounded-full bg-accent" style={{ width: `${Math.max(2, (p.glm / (spend.glm || 1)) * 100)}%` }} /></span></td>
            <td className="px-3 py-2 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>{formatCount(p.writes)}</td>
            <td className="px-3 py-2 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>{glm(p.perWrite)}</td>
          </tr>))}</tbody>
      </table>
    </div>
  );
}
