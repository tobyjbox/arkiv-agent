import type { Expression } from "@arkiv-network/sdk/query";
import type { ArkivClient } from "@arkiv-agent/core";
import { type Result, err, ok } from "@arkiv-agent/core";
import { MAX_RESULTS } from "./query.ts";

/** Ask Arkiv gives up on a page after this, so the page can say so instead of hanging. */
export const ASK_TIMEOUT_MS = 15_000;
const PREVIEW_CHARS = 120;

export type AskRow = {
  key: string;
  owner: string | null;
  createdAtBlock: string | null;
  expiresAtBlock: string | null;
  attributes: Record<string, string>;
  payloadPreview: string | null;
};

export type AskPage = { rows: AskRow[]; block: string; cursor: string | null; ms: number };
export type RunError = { kind: "timeout" | "rpc"; message: string };

type SdkEntity = {
  key?: string;
  owner?: string;
  createdAt?: bigint | number;
  expiresAt?: bigint | number;
  attributes?: Readonly<Record<string, { type: string; value: unknown }>>;
  payload?: Uint8Array;
  contentType?: string;
};

function preview(payload: Uint8Array | undefined, contentType: string | undefined): string | null {
  if (!payload?.length) return null;
  const isText = !contentType || /^(text\/|application\/(json|xml|.*\+json))/.test(contentType);
  if (!isText) return `${payload.length.toLocaleString("en")} bytes of ${contentType}`;
  // Untrusted text from the chain: shown as text only, capped.
  return new TextDecoder("utf-8", { fatal: false }).decode(payload.subarray(0, PREVIEW_CHARS * 4)).slice(0, PREVIEW_CHARS);
}

const toRow = (e: SdkEntity): AskRow => ({
  key: e.key ?? "",
  owner: e.owner ?? null,
  createdAtBlock: e.createdAt === undefined ? null : String(e.createdAt),
  expiresAtBlock: e.expiresAt === undefined ? null : String(e.expiresAt),
  attributes: Object.fromEntries(Object.entries(e.attributes ?? {}).filter(([, v]) => v.type !== "bytes").map(([k, v]) => [k, String(v.value)])),
  payloadPreview: preview(e.payload, e.contentType),
});

/**
 * Runs a compiled query live on Arkiv, read-only (public client, `arkiv_query` only), one page at
 * a pinned block. Later pages pass the block and cursor back so they read the same state.
 * `connect` builds a client bound to an abort signal: on timeout the read is aborted, not abandoned.
 */
export async function runAsk(
  connect: (signal: AbortSignal) => ArkivClient,
  expression: Expression,
  opts: { limit?: number; cursor?: string | null; block?: string | null; timeoutMs?: number } = {},
): Promise<Result<AskPage, RunError>> {
  const started = performance.now();
  const timeoutMs = opts.timeoutMs ?? ASK_TIMEOUT_MS;
  const controller = new AbortController();
  const client = connect(controller.signal);
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => { controller.abort(new Error("Ask timeout")); resolve("timeout"); }, timeoutMs);
  });
  try {
    const read = (async () => {
      const block = opts.block ? BigInt(opts.block) : await client.getBlockNumber();
      let q = client
        .select({ key: true, owner: true, createdAt: true, expiresAt: true, attributes: true, payload: true, contentType: true })
        .where(expression)
        .atBlock(block)
        .limit(Math.min(opts.limit ?? MAX_RESULTS, MAX_RESULTS));
      if (opts.cursor) q = q.cursor(opts.cursor);
      return q.fetch();
    })();
    read.catch(() => {}); // after a timeout the aborted read rejects; nobody is waiting for it
    const page = await Promise.race([read, timeout]);
    if (page === "timeout") return err({ kind: "timeout", message: `Arkiv didn't respond in ${Math.round(timeoutMs / 1000)} s.` });
    return ok({
      rows: (page.entities as unknown as SdkEntity[]).map(toRow),
      block: String(page.blockNumber),
      cursor: page.cursor ?? null,
      ms: Math.round(performance.now() - started),
    });
  } catch (cause) {
    return err({ kind: "rpc", message: cause instanceof Error ? cause.message.split("\n")[0]! : String(cause) });
  } finally {
    clearTimeout(timer);
  }
}
