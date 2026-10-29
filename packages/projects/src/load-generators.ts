import { loadCatalogue } from "@arkiv-agent/catalogue";

/**
 * Arkiv's load generators: wallets (lowercase) with over 5,000 creates in the last 7 days, as the
 * catalogue's last build saw them, so they match the datasets it marks as load generators.
 */
export function loadGeneratorOwners(): ReadonlySet<string> {
  return new Set([...loadCatalogue().busyOwners].map((w) => w.toLowerCase()));
}
