/** `search` with `patch` applied: a string sets a param, null removes it, and every other param stays. */
export function withQuery(search: string, patch: Record<string, string | null>): string {
  const q = new URLSearchParams(search);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) q.delete(k);
    else q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** Writes `patch` into this page's URL in place (no navigation), so controls sharing a page keep each other's state. */
export const replaceQuery = (patch: Record<string, string | null>) =>
  window.history.replaceState(null, "", `${window.location.pathname}${withQuery(window.location.search, patch)}`);
