import { createPublicClient } from "@arkiv-network/sdk";
import { u64 } from "@arkiv-network/sdk/attr";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { gt } from "@arkiv-network/sdk/query";
import { http } from "viem";

export const DEFAULT_RPC_URL = tiramisu.rpcUrls.default.http[0];

/** Node maximum for `arkiv_query` pages. */
export const PAGE_SIZE = 200;

/**
 * Read-only Tiramisu client with retry and backoff for long walks. An Arkiv Hub access key, when
 * set, raises the anonymous limits (600 requests/min, and a small separate `arkiv_query` budget).
 * A `signal` aborts every request the client makes (Ask uses one client per read, so a timeout
 * stops the read instead of leaving it running).
 */
export function createArkivClient(
  rpcUrl = process.env.ARKIV_RPC_URL ?? DEFAULT_RPC_URL,
  apiKey = process.env.ARKIV_API_KEY,
  { signal, retryCount = 5, onResponse }: { signal?: AbortSignal; retryCount?: number; onResponse?: (response: Response) => void } = {},
) {
  const fetchOptions = { ...(apiKey && { headers: { "X-API-KEY": apiKey } }), ...(signal && { signal }) };
  return createPublicClient({
    chain: tiramisu,
    // A full 20,000-log page is ~11 MB, over viem's 10 MB default response cap.
    transport: http(rpcUrl, { retryCount, retryDelay: 400, timeout: 30_000, maxResponseBodySize: 32 * 1024 * 1024, fetchOptions, ...(onResponse && { onFetchResponse: onResponse }) }),
  });
}

export type ArkivClient = ReturnType<typeof createArkivClient>;

/**
 * Matches every entity live at `block`. The query language has no "match all"; `$expiresAt` is
 * the one indexed system attribute with an order, and a bound at the read block is ~4x faster
 * on Tiramisu than `> 0` (1.6 s vs 7 s per 200-row page, 2026-10-28).
 */
export const allLive = (block: bigint) => gt("$expiresAt", u64(block));

/** Arkiv's entity registry: every entity operation is a transaction to, and log from, here. */
export const ARKIV_ADDRESS = "0x4400000000000000000000000000000000000044" as const;
