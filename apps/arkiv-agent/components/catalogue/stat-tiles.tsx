"use client";

import { compact, formatCount } from "../../lib/format";
import { RollingNumber } from "../ui/rolling-number";
import { Sparkline } from "../ui/sparkline";

/** `text` shows a non-numeric value (e.g. a duration) instead of a rolling number. */
export type Tile = { label: string; value: number; tooltip: string; series?: number[]; format?: (n: number) => string; text?: string };

/** Stat tiles: label, rolling value with delta chip, optional 24 h sparkline (only where we have history). */
export function StatTiles({ tiles, isCompact = false }: { tiles: Tile[]; isCompact?: boolean }) {
  return (
    <div className={`grid grid-cols-2 gap-4 ${isCompact ? "" : "lg:grid-cols-4"}`}>
      {tiles.map((t) => (
        <div key={t.label} className="rounded-md bg-surface p-5" title={t.tooltip}>
          <div className="label text-text-secondary">{t.label}</div>
          <div className="mt-2 stat">
            {t.text ?? <RollingNumber value={t.value} format={t.format ?? formatCount} showDelta />}
          </div>
          {t.series ? <Sparkline points={t.series} className="mt-3" /> : <div className="mt-3 h-8" aria-hidden />}
        </div>
      ))}
    </div>
  );
}

export const compactFormat = compact;
