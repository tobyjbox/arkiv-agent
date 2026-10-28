import { AlertTriangle, Clock, Sparkles } from "lucide-react";
import Link from "next/link";
import type { DatasetRow as Row } from "../../lib/catalogue";
import { ago, duration, formatCount, middle, percent } from "../../lib/format";
import { RollingNumber } from "../ui/rolling-number";
import { Sparkline } from "../ui/sparkline";

const DAY = 86_400;

/** One dataset (design/03-catalogue.md "Dataset row"): the whole row links to the detail page. */
export function DatasetRow({ row, ageSeconds, description, flash, onPrefetch }: {
  row: Row; ageSeconds: number; description?: string; flash: "new" | "changed" | null; onPrefetch: () => void;
}) {
  const isActive = ageSeconds < 3_600;
  const types = [...new Set(row.fields.map((f) => f.type))];
  const label = row.project.method === "label" ? row.project.label : middle(row.project.label);
  return (
    <tr className={`group relative border-b border-border-subtle hover:bg-raised ${flash === "new" ? "row-in flash" : flash === "changed" ? "flash" : ""}`}
      onMouseEnter={onPrefetch} onFocus={onPrefetch}>
      <td className="px-3 py-2.5 align-top">
        <Link href={`/catalogue/${row.id}`} className="after:absolute after:inset-0 focus-visible:outline-none">
          <span className="flex items-center gap-2">
            <span className={`size-2 shrink-0 rounded-full ${isActive ? "bg-live" : "bg-text-tertiary"}`} role="img" aria-label={isActive ? "active in last hour" : "no writes in last hour"} />
            <span className="font-mono text-[13px] text-text-primary">{row.name}</span>
            {row.isLoadGenerator && <span className="caption rounded-sm px-1.5 tint-warn">load generator</span>}
          </span>
        </Link>
        <div className="mt-0.5 flex items-center gap-2 pl-4 caption text-text-tertiary">
          {description ? (
            <span className="flex min-w-0 items-center gap-1 text-ai"><Sparkles size={12} aria-hidden /><span className="truncate">{description}</span></span>
          ) : null}
          <span className="shrink-0 font-mono">{types.slice(0, 3).join(" · ")}{types.length > 3 ? ` +${types.length - 3}` : ""}</span>
        </div>
      </td>
      <td className="px-3 py-2.5 align-top">
        <div className="flex items-center gap-1 text-text-primary">
          <span className={row.project.method === "creator" ? "font-mono text-[13px]" : ""}>{label}</span>
          {row.project.conflictWallets && (
            <AlertTriangle size={14} className="text-warn" aria-label={`This label is used by ${row.project.conflictWallets} unrelated wallets`}>
              <title>{`This label is used by ${row.project.conflictWallets} unrelated wallets. Labels on Arkiv aren't locks.`}</title>
            </AlertTriangle>
          )}
        </div>
        <div className={`caption ${row.project.confidence < 0.7 ? "text-warn" : "text-text-tertiary"}`}>
          {row.project.method === "label" ? "label" : "creator wallet"} · {percent(row.project.confidence)}
        </div>
      </td>
      <td className="px-3 py-2.5 text-right align-top">
        <RollingNumber value={row.liveCount} />
        <Sparkline points={row.hourly24h} height={16} className="mt-1 ml-auto max-w-20" />
      </td>
      <td className="px-3 py-2.5 text-right align-top">
        <div>{formatCount(row.writers)}</div>
        <span className="caption rounded-sm border border-border-default px-1.5 text-text-secondary">{row.ownership}</span>
      </td>
      <td className="hidden px-3 py-2.5 text-right align-top md:table-cell">{duration(row.medianLifetimeBlocks)}</td>
      <td className="px-3 py-2.5 text-right align-top">
        <div className="text-text-tertiary">{ago(ageSeconds)}</div>
        {ageSeconds > DAY && (
          <div className="caption flex items-center justify-end gap-1 text-warn"><Clock size={12} aria-hidden />Quiet {Math.floor(ageSeconds / DAY)} d</div>
        )}
      </td>
    </tr>
  );
}
