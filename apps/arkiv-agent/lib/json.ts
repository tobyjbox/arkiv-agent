import { gzipSync } from "node:zlib";

/** Under this, gzip saves nothing worth the header. */
const MIN_BYTES = 1_024;

/**
 * A JSON response, gzipped when the caller accepts it. Next compresses pages itself but was seen
 * sending API JSON as it is (the catalogue is 635 KB every 5 s), so the routes do it here. Next
 * leaves a response alone once it carries Content-Encoding, so nothing is compressed twice.
 */
export function json(request: Request, data: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response {
  const body = JSON.stringify(data);
  const headers: Record<string, string> = { "Content-Type": "application/json", Vary: "Accept-Encoding", ...init.headers };
  const accepts = /\bgzip\b/.test(request.headers.get("accept-encoding") ?? "");
  if (!accepts || body.length < MIN_BYTES) return new Response(body, { status: init.status ?? 200, headers });
  return new Response(gzipSync(body), { status: init.status ?? 200, headers: { ...headers, "Content-Encoding": "gzip" } });
}
