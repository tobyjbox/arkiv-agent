import { type NextRequest, NextResponse } from "next/server";
import { isAllowedHost } from "./lib/guard";

/** Every request, pages included: refuse host names that aren't local (DNS rebinding). */
/** Pages that aggregate the whole index on request (seconds of work). */
const HEAVY = /^\/(pulse|cost)(\/|$)/;

/**
 * Every request, pages included: refuse host names that aren't local (DNS rebinding). The heavy pages
 * also refuse being loaded by another site as an embed, fetch or frame (T19 L1); following a link to
 * them is still fine. No page may be framed.
 */
export function middleware(request: NextRequest) {
  if (!isAllowedHost(request.headers.get("host"))) return new NextResponse("Unknown host.", { status: 421 });
  const site = request.headers.get("sec-fetch-site");
  const isCrossSite = site === "cross-site" || site === "same-site";
  const isTopLevel = request.headers.get("sec-fetch-mode") === "navigate" && request.headers.get("sec-fetch-dest") !== "iframe";
  if (HEAVY.test(request.nextUrl.pathname) && isCrossSite && !isTopLevel) return new NextResponse("Open ArkivAgent directly.", { status: 403 });
  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", "frame-ancestors 'none'");
  return response;
}

export const config = { matcher: "/((?!_next/static|_next/image|favicon.ico).*)" };
