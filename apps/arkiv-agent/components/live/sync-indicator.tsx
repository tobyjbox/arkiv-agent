"use client";

import { useEffect, useRef, useState } from "react";
import { ago, formatCount } from "../../lib/format";
import { RollingNumber } from "../ui/rolling-number";
import { type SyncState as State, syncState } from "../../lib/sync-state";
import { useLive, useSecondsSince } from "./live-provider";


/** Pattern 1: `● Synced 3 s ago · block 1,204,331`. Age is the index's own heartbeat, not ours. */
export function SyncIndicator() {
  const live = useLive();
  const age = useSecondsSince(live.syncedAt);
  // Two different things: ArkivAgent's own API not answering (offline), and the API answering while the
  // index stops moving (stale: `pnpm index` ran once, no --watch). Only the first is "can't reach".
  const [mountedAt] = useState(() => new Date().toISOString());
  const sinceOk = useSecondsSince(live.lastOkAt === null ? mountedAt : new Date(live.lastOkAt).toISOString());
  const state = syncState(age, sinceOk, live.isBehind);
  // The server can't know the age when the page is read, so it doesn't claim one ("Synced 0 s ago").
  const [isMounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const announced = useAnnouncement(state);
  const dot = !isMounted ? "bg-text-tertiary" : { live: "bg-live", behind: "bg-warn", delayed: "bg-warn", stale: "bg-warn", offline: "bg-danger" }[state];
  const tooltip = `Last index sync ${live.syncedAt ?? "never"} · block ${formatCount(Number(live.indexedBlock))} · checks every 5 s · source: ArkivAgent index${
    state === "stale" ? " · the indexer isn't running: start `pnpm index --watch` to keep it live" : ""}`;

  return (
    <div className="flex items-center gap-2 caption text-text-tertiary" title={tooltip}>
      <span className="relative flex size-2" aria-hidden>
        {isMounted && state === "live" && <span className="live-ring absolute inset-0 rounded-full bg-live" />}
        <span className={`relative size-2 rounded-full ${dot}`} />
      </span>
      {!isMounted ? (
        <span className="hidden sm:inline">Checking sync · block {formatCount(Number(live.indexedBlock))}</span>
      ) : state === "offline" ? (
        <span>
          Sync paused ·{" "}
          <button type="button" onClick={live.retry} className="text-accent underline-offset-2 hover:underline">Retry</button>
        </span>
      ) : state === "behind" ? (
        <span className="text-warn">Index {formatCount(Number(live.lagBlocks))} blocks behind</span>
      ) : (
        <span className="hidden sm:inline">
          Synced {ago(age ?? 0)}{state === "delayed" ? " · retrying" : state === "stale" ? " · index not updating" : ""} · block{" "}
          <RollingNumber value={Number(live.indexedBlock)} className="text-text-secondary" />
        </span>
      )}
      <span className="sm:hidden">{!isMounted || age === null ? "–" : `${age}s`}</span>
      <span className="sr-only" aria-live="polite">{announced}</span>
    </div>
  );
}

/** Only moves into Delayed or Offline are announced, once each (Pattern 1, screen readers). */
function useAnnouncement(state: State): string {
  const [text, setText] = useState("");
  const prev = useRef(state);
  useEffect(() => {
    if (state !== prev.current && (state === "delayed" || state === "stale" || state === "offline")) {
      setText({ delayed: "Sync delayed, retrying.", stale: "The index is not updating.", offline: "Sync paused. ArkivAgent can't reach its server." }[state]);
    }
    prev.current = state;
  }, [state]);
  return text;
}
