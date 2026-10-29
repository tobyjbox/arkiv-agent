"use client";

import { type RefObject, useEffect, useRef, useState } from "react";
import type { CatalogueData, DatasetRow } from "../../lib/catalogue";

const FLASH_MS = 2_000;
/** Pattern 4 batch rule: more changes than this in one tick are applied without per-row motion. */
const MAX_ANIMATED = 8;
const ANNOUNCE_EVERY_MS = 30_000;

type Flash = "new" | "changed";
const isChanged = (a: DatasetRow, b: DatasetRow) => a.liveCount !== b.liveCount || a.writes24h !== b.writes24h || a.lastWriteBlock !== b.lastWriteBlock;

/**
 * Keeps the list in step with the index: refetches when the change feed moves, flashes what
 * changed, and holds updates while the pointer or focus is in the list (no reorder under the hand).
 */
export function useLiveRows(initial: CatalogueData, version: number, list: RefObject<HTMLElement | null>) {
  const [data, setData] = useState(initial);
  const [flashes, setFlashes] = useState(new Map<string, Flash>());
  const [held, setHeld] = useState<{ next: CatalogueData; diff: Map<string, Flash> } | null>(null);
  const [isRefreshing, setRefreshing] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const current = useRef(data);
  current.current = data;
  const tally = useRef({ datasets: 0, at: Date.now() });

  const apply = (next: CatalogueData, diff: Map<string, Flash>) => {
    setData(next);
    setHeld(null);
    if (diff.size === 0 || diff.size > MAX_ANIMATED) return;
    setFlashes(diff);
    setTimeout(() => setFlashes(new Map()), FLASH_MS);
  };

  useEffect(() => {
    if (version === 0) return;
    let isStale = false;
    setRefreshing(true);
    void fetch("/api/catalogue", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<CatalogueData>) : null))
      .then((next) => {
        if (!next || isStale) return;
        const before = new Map(current.current.rows.map((r) => [r.id, r]));
        const diff = new Map<string, Flash>();
        for (const r of next.rows) {
          const old = before.get(r.id);
          if (!old) diff.set(r.id, "new");
          else if (isChanged(old, r)) diff.set(r.id, "changed");
        }
        tally.current.datasets += [...diff.values()].filter((f) => f === "new").length;
        if (Date.now() - tally.current.at > ANNOUNCE_EVERY_MS && tally.current.datasets > 0) {
          setAnnouncement(`${tally.current.datasets} new datasets since the last update.`);
          tally.current = { datasets: 0, at: Date.now() };
        }
        const el = list.current;
        const isUserInList = !!el && (el.matches(":hover") || el.contains(document.activeElement) || window.scrollY > el.offsetTop);
        if (isUserInList && diff.size) setHeld({ next, diff });
        else apply(next, diff);
      })
      .finally(() => !isStale && setRefreshing(false));
    return () => { isStale = true; };
  }, [version, list]);

  return {
    data, flashes, isRefreshing, announcement,
    pending: held?.diff.size ?? 0,
    applyPending: () => {
      if (!held) return;
      apply(held.next, held.diff);
      window.scrollTo({ top: (list.current?.offsetTop ?? 0) - 80, behavior: "smooth" });
    },
  };
}
