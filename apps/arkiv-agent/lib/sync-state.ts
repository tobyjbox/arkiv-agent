/** Seconds after which the index or the server counts as not moving. */
export const OFFLINE_AFTER_S = 120;
/** Fresher than this is live. */
export const LIVE_UNDER_S = 15;

export type SyncState = "live" | "delayed" | "stale" | "offline" | "behind";

/**
 * Pattern 1's states. `indexAgeS`: seconds since the index last synced. `sinceServerOkS`: seconds
 * since ArkivAgent's own API last answered. A server that answers while the index stands still (`pnpm
 * index` without --watch) is "stale", not "offline": only "offline" means ArkivAgent can't be reached.
 */
export function syncState(indexAgeS: number | null, sinceServerOkS: number | null, isBehind: boolean): SyncState {
  if ((sinceServerOkS !== null && sinceServerOkS > OFFLINE_AFTER_S) || indexAgeS === null) return "offline";
  if (indexAgeS > OFFLINE_AFTER_S) return "stale";
  if (indexAgeS >= LIVE_UNDER_S) return "delayed";
  return isBehind ? "behind" : "live";
}
