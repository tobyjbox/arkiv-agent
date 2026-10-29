import type { Parse } from "../parse.ts";
import { MAX_RESULTS } from "../../query.ts";
import { TIME_UNITS } from "../tokens.ts";

/**
 * "first 10", "top 5", "latest 20": how many results. Runs before the dataset is chosen. "first/top N"
 * is just a count; "latest/newest N" also asks for an order Arkiv can't give, so that word stays free
 * for `sortNote`. "last 7 days" is a time window, not a count.
 */
export function resultLimit(p: Parse): void {
  const { tokens, consumed } = p;
  tokens.forEach((t, i) => {
    const next = tokens[i + 1];
    if (/^(first|top|latest|last|newest)$/.test(t.low) && next && /^\d{1,3}$/.test(next.low) && !TIME_UNITS[tokens[i + 2]?.low ?? ""]) {
      p.limit = Math.min(MAX_RESULTS, Math.max(1, Number(next.low)));
      consumed.add(i + 1);
      if (/^(first|top)$/.test(t.low)) consumed.add(i);
    }
  });
}

/** "latest", "newest", "oldest" left unused: Arkiv can't sort, so say the order isn't applied. */
export function sortNote(p: Parse): void {
  if (p.tokens.some((t, i) => /^(latest|newest|recent|oldest|earliest)$/.test(t.low) && !p.consumed.has(i))) {
    p.explain.push("Arkiv can't sort query results, so newest-first isn't applied: these are the first records it returns.");
  }
}
