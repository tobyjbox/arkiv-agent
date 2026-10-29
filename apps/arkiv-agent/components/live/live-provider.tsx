"use client";

import type { FeedResponse } from "@arkiv-agent/db";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { type SyncState, syncState } from "../../lib/sync-state";

/** Client side of the change feed (design/02-feels-live.md): poll every 5 s while visible. */
const POLL_MS = 5_000;
export { LIVE_UNDER_S, OFFLINE_AFTER_S } from "../../lib/sync-state";

export type Change = FeedResponse["changes"][number];
type Snapshot = Omit<FeedResponse, "changes" | "reset">;

type LiveState = Snapshot & {
  /** Bumps when the index changed since the last poll; data views refetch on it. */
  version: number;
  isChecking: boolean;
  /** Last poll that reached the server (ms), null until the first one. */
  lastOkAt: number | null;
  lastChanges: Change[];
  retry: () => void;
};

const LiveContext = createContext<LiveState | null>(null);

export function useLive(): LiveState {
  const live = useContext(LiveContext);
  if (!live) throw new Error("useLive outside LiveProvider");
  return live;
}

export function LiveProvider({ initial, children }: { initial: Snapshot; children: ReactNode }) {
  const [snap, setSnap] = useState(initial);
  const [version, setVersion] = useState(0);
  const [isChecking, setChecking] = useState(false);
  const [lastOkAt, setLastOkAt] = useState<number | null>(null);
  const [lastChanges, setLastChanges] = useState<Change[]>([]);
  const cursor = useRef(initial.cursor);
  const inFlight = useRef(false);

  const poll = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setChecking(true);
    try {
      const res = await fetch(`/api/changes?since=${cursor.current}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const feed = (await res.json()) as FeedResponse;
      const { changes, reset, ...rest } = feed;
      cursor.current = feed.cursor;
      setSnap(rest);
      setLastOkAt(Date.now());
      if (reset || changes.length) {
        setLastChanges(changes);
        setVersion((v) => v + 1);
      }
    } catch {
      // Status falls to "delayed" then "offline" as syncedAt ages; the next poll retries.
    } finally {
      inFlight.current = false;
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void poll();
    let timer = setInterval(poll, POLL_MS);
    const onVisibility = () => {
      clearInterval(timer);
      if (document.visibilityState === "visible") {
        void poll();
        timer = setInterval(poll, POLL_MS);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [poll]);

  return (
    <LiveContext.Provider value={{ ...snap, version, isChecking, lastOkAt, lastChanges, retry: () => void poll() }}>
      {children}
    </LiveContext.Provider>
  );
}

/**
 * The top bar's sync state (Pattern 1), for anything that has to agree with it. Two different things:
 * ArkivAgent's own API not answering (offline), and the API answering while the index stops moving
 * (stale: `pnpm index` ran once, no --watch). Only the first is "can't reach".
 */
export function useSyncState(): SyncState {
  const live = useLive();
  const age = useSecondsSince(live.syncedAt);
  const [mountedAt] = useState(() => new Date().toISOString());
  const sinceOk = useSecondsSince(live.lastOkAt === null ? mountedAt : new Date(live.lastOkAt).toISOString());
  return syncState(age, sinceOk, live.isBehind);
}

/**
 * Seconds since `iso`, ticking every second (the honest "counting up" motion). The clock starts
 * at mount, so the server render and the first client render agree (0) and hydration matches.
 */
export function useSecondsSince(iso: string | null): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, []);
  if (!iso) return null;
  return now === null ? 0 : Math.max(0, Math.round((now - Date.parse(iso)) / 1_000));
}
