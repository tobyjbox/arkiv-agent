import { type NextRequest, NextResponse } from "next/server";
import { isAllowedHost, isCrossSiteEmbed } from "./lib/guard";

/** Pages that aggregate the whole index on request (seconds of work). */
const HEAVY = /^\/(pulse|cost)(\/|$)/;

/**
 * Every request, pages included: refuse host names that aren't local (DNS rebinding). The heavy pages
 * also refuse being loaded by another site as an embed, fetch or frame (T19 L1); following a link to
 * them is still fine. No page may be framed.
 */
export function middleware(request: NextRequest) {
  if (!isAllowedHost(request.headers.get("host"))) return new NextResponse("Unknown host.", { status: 421 });
  if (HEAVY.test(request.nextUrl.pathname) && isCrossSiteEmbed(request.headers)) return new NextResponse("Open ArkivAgent directly.", { status: 403 });
  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", "frame-ancestors 'none'");
  return response;
}

export const config = { matcher: "/((?!_next/static|_next/image|favicon.ico).*)" };
