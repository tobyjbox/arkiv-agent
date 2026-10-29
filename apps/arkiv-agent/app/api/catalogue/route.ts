import { getCatalogueData } from "../../../lib/catalogue";

export const dynamic = "force-dynamic";

/** The list's data, refetched by the client when the change feed reports index changes. */
export function GET() {
  return Response.json(getCatalogueData(), { headers: { "Cache-Control": "no-store" } });
}
