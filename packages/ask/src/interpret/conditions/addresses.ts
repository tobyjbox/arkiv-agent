import type { Parse } from "../parse.ts";

/**
 * Wallet addresses: "owned by 0x…" is `$owner`, "created by 0x…" `$creator`. Runs before the dataset
 * is chosen, so an address is never read as part of a dataset's name.
 */
export function addresses(p: Parse): void {
  const { tokens, consumed, conds } = p;
  tokens.forEach((t, i) => {
    if (!/^0x[0-9a-fA-F]{40}$/.test(t.raw)) return;
    consumed.add(i);
    const before = tokens.slice(Math.max(0, i - 3), i).map((x) => x.low);
    const attr = before.some((w) => /^(created|creator|written|writer|wrote|made)$/.test(w)) ? "$creator" : "$owner";
    for (let k = Math.max(0, i - 3); k < i; k++) if (/^(owned|owner|owners|created|creator|written|writer|wrote|made|by|from)$/.test(tokens[k]!.low)) consumed.add(k);
    conds.push({ attr, q: { op: "eq", attr, type: "addr", value: t.raw }, tokens: [i] });
  });
}
