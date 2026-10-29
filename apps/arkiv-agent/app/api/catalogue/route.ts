import { getCatalogueData } from "../../../lib/catalogue";
import { indexNotReady } from "../../../lib/db";

export const dynamic = "force-dynamic";

/** The list's data, refetched by the client when the change feed reports index changes. */
export function GET() {
  return indexNotReady() ?? Response.json(getCatalogueData(), { headers: { "Cache-Control": "no-store" } });
}
