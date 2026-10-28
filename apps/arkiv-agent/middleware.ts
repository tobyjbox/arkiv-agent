import { type NextRequest, NextResponse } from "next/server";
import { isAllowedHost } from "./lib/guard";

/** Every request, pages included: refuse host names that aren't local (DNS rebinding). */
export function middleware(request: NextRequest) {
  if (!isAllowedHost(request.headers.get("host"))) return new NextResponse("Unknown host.", { status: 421 });
  return NextResponse.next();
}

export const config = { matcher: "/((?!_next/static|_next/image|favicon.ico).*)" };
