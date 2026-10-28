"use client";

import type { Dataset, RecordView } from "@arkiv-agent/catalogue";
import { useEffect, useRef, useState } from "react";
import { ago, BLOCK_SECONDS, duration, formatCount, middle } from "../../lib/format";
import { useLive } from "../live/live-provider";
import { StatTiles } from "../catalogue/stat-tiles";
import { CopyButton } from "../ui/copy-button";

type Live = { dataset: Dataset; chainHead: number; records: RecordView[] };

/** Stats and recent records that follow the change feed; new records slide in (Pattern 4). */
export function DatasetLive({ initial, part }: { initial: Live; part: "stats" | "records" }) {
  const { version } = useLive();
  const [data, setData] = useState(initial);
  const seen = useRef(new Set(initial.records.map((r) => r.key)));
  const [fresh, setFresh] = useState(new Set<string>());

  useEffect(() => {
    if (version === 0) return;
    void fetch(`/api/datasets/${initial.dataset.id}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((next: Live | null) => {
      if (!next) return;
      const added = next.records.filter((r) => !seen.current.has(r.key)).map((r) => r.key);
      added.forEach((k) => seen.current.add(k));
      setData(next);
      if (added.length && added.length <= 8) {
        setFresh(new Set(added));
        setTimeout(() => setFresh(new Set()), 2_000);
      }
    });
  }, [version, initial.dataset.id]);

  const d = data.dataset;
  if (part === "stats") {
    return (
      <StatTiles isCompact tiles={[
        { label: "Live", value: d.liveCount, tooltip: "Live records in this dataset. From ArkivAgent index." },
        { label: "Writers", value: d.writers, tooltip: `Distinct wallets writing it (${d.ownership}).` },
        { label: "Median life", value: 0, text: duration(d.medianLifetimeBlocks), tooltip: "Median planned lifetime of live records (creation to expiry)." },
        { label: "Payload (median)", value: d.medianPayloadBytes ?? 0, format: (n) => `${formatCount(n)} B`, tooltip: `Content types: ${d.contentTypes.join(", ") || "none"}` },
      ]} />
    );
  }
  if (!data.records.length) return <p className="rounded-md bg-surface p-6 text-text-secondary">No live records right now.</p>;
  return (
    <ul className="divide-y divide-border-subtle overflow-hidden rounded-md bg-surface">
      {data.records.map((r) => {
        const expiresIn = r.expiresAt === null ? "never expires" : r.status === "live" ? `expires in ${duration(Math.max(0, r.expiresAt - data.chainHead))}` : r.status;
        return (
          <li key={r.key} className={`space-y-1.5 px-4 py-3 ${fresh.has(r.key) ? "row-in flash" : ""} ${r.status === "live" ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 caption text-text-tertiary">
              <span className="font-mono text-[13px] text-text-primary" title={r.key}>{middle(r.key, 8)}</span>
              <CopyButton value={r.key} label="Copy key" />
              <span title={r.owner}>owner <span className="font-mono">{middle(r.owner)}</span></span>
              <span>block {formatCount(r.createdAtBlock)} · {ago((data.chainHead - r.createdAtBlock) * BLOCK_SECONDS)}</span>
              <span className={r.status === "live" ? "" : "rounded-sm px-1.5 tint-warn"}>{r.status === "live" ? expiresIn : r.status === "expired" ? "Expired" : "Deleted"}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {r.attributes.map((a) => (
                <span key={a.name} className="max-w-xs truncate rounded-sm border border-border-default px-1.5 font-mono text-[12px] text-text-secondary">
                  {a.name}: <span className="text-text-primary">{a.value}</span>
                </span>
              ))}
            </div>
            {r.payloadPreview && <p className="truncate font-mono text-[12px] text-text-tertiary">{r.payloadPreview}</p>}
          </li>
        );
      })}
    </ul>
  );
}
