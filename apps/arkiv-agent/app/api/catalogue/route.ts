import { getCatalogueData } from "../../../lib/catalogue";
import { indexNotReady } from "../../../lib/db";
import { json } from "../../../lib/json";

export const dynamic = "force-dynamic";

/** The list's data, refetched by the client when the change feed reports index changes. */
export function GET(request: Request) {
  return indexNotReady() ?? json(request, getCatalogueData(), { headers: { "Cache-Control": "no-store" } });
}
