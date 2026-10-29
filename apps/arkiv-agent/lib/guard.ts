// Request checks for a local app that can spend an API key. ArkivAgent binds to 127.0.0.1 (package.json)
// so LAN peers can't reach it; these checks keep other websites in the user's own browser out.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Only answer to local host names (plus ARKIV_AGENT_ALLOWED_HOSTS, comma-separated; the pre-rename
 * ARKIV_AGENT_ALLOWED_HOSTS still works for one release, see next.config.ts). A DNS-rebinding page
 * reaches 127.0.0.1 under its own name, so its Origin matches its Host: the host name gives it away.
 */
export function isAllowedHost(host: string | null, extra = process.env.ARKIV_AGENT_ALLOWED_HOSTS ?? process.env.ARKIV_AGENT_ALLOWED_HOSTS): boolean {
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

/**
 * True when another site loads a page as an embed, fetch or frame rather than by following a link
 * (T19 L1). Fetch Metadata says so directly. Browsers that don't send it (Safari before 16.4, some
 * webviews) fall back to Origin or Referer: from another host, anything not asking for HTML counts as
 * an embed. Their cross-site frames still ask for HTML; frame-ancestors keeps those from showing.
 */
export function isCrossSiteEmbed(headers: Headers): boolean {
  const site = headers.get("sec-fetch-site");
  if (site) {
    const isTopLevel = headers.get("sec-fetch-mode") === "navigate" && headers.get("sec-fetch-dest") !== "iframe";
    return (site === "cross-site" || site === "same-site") && !isTopLevel;
  }
  const from = headers.get("origin") ?? headers.get("referer");
  if (from === null) return false;
  let fromHost: string | null = null;
  try { fromHost = new URL(from).host; } catch { /* "null" or malformed */ }
  if (fromHost !== null && fromHost.toLowerCase() === headers.get("host")?.toLowerCase()) return false;
  return !(headers.get("accept") ?? "").includes("text/html");
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
