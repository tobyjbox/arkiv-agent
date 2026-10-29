// Recorded chain fixtures: JSON with bigints tagged as {"$big": "…"} so they round-trip exactly.
import type { Hex } from "viem";
import type { RawLog } from "../chain.ts";

export type Fixture = { chainId: number; fromBlock: bigint; toBlock: bigint; owners: Hex[]; logs: RawLog[]; inputs: Record<Hex, Hex> };

export const stringify = (f: Fixture) =>
  JSON.stringify(f, (_, v) => (typeof v === "bigint" ? { $big: v.toString() } : v), 1);

export const parse = (json: string): Fixture =>
  JSON.parse(json, (_, v) => (v && typeof v === "object" && "$big" in v ? BigInt(v.$big) : v));
