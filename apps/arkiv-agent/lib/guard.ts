// Request checks for a local app that can spend an API key. ArkivAgent binds to 127.0.0.1 (package.json)
// so LAN peers can't reach it; these checks keep other websites in the user's own browser out.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Only answer to local host names (plus ARKIV_AGENT_ALLOWED_HOSTS, comma-separated). A DNS-rebinding page
 * reaches 127.0.0.1 under its own name, so its Origin matches its Host: the host name gives it away.
 */
export function isAllowedHost(host: string | null, extra = process.env.ARKIV_AGENT_ALLOWED_HOSTS): boolean {
  if (!host) return false;
  const name = host.toLowerCase().replace(/:\d+$/, "");
  const allowed = (extra ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
  return LOCAL_HOSTS.has(name) || allowed.includes(name);
}

/**
 * Same-origin JSON only, for the POST routes. Another site can send a "simple" cross-origin POST
 * (text/plain, no preflight); requiring application/json forces a preflight that ArkivAgent never
 * approves, and the Origin and Sec-Fetch-Site checks refuse anything that arrives anyway.
 * Returns the refusal to send, or null to go ahead.
 */
export function refuseCrossSite(request: Request): Response | null {
  const host = request.headers.get("host");
  if (!isAllowedHost(host)) return Response.json({ error: "Unknown host." }, { status: 421 });
  if (!/^application\/json\s*(;|$)/i.test(request.headers.get("content-type") ?? "")) {
    return Response.json({ error: "Send the body as application/json." }, { status: 415 });
  }
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return Response.json({ error: "Cross-site requests are refused." }, { status: 403 });
  const origin = request.headers.get("origin");
  if (origin !== null) {
    let originHost: string | null = null;
    try { originHost = new URL(origin).host; } catch { /* "null" or malformed */ }
    if (originHost?.toLowerCase() !== host?.toLowerCase()) return Response.json({ error: "Cross-origin requests are refused." }, { status: 403 });
  }
  return null;
}

/** A small per-process budget for model calls, so a runaway client can't spend the key quickly. */
export function createRateLimit(perMinute: number, now = () => Date.now()) {
  const recent: number[] = [];
  return () => {
    const t = now();
    while (recent.length && t - recent[0]! >= 60_000) recent.shift();
    if (recent.length >= perMinute) return false;
    recent.push(t);
    return true;
  };
}
