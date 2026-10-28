export type ArkivAgentError =
  | { kind: "rpc"; message: string; cause?: unknown }
  | { kind: "query"; message: string; query: string }
  | { kind: "decode"; message: string };

export type Result<T, E = ArkivAgentError> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/** Runs a promise and folds a throw into an `rpc` error, so callers branch instead of catching. */
export async function attempt<T>(run: () => Promise<T>): Promise<Result<T>> {
  try {
    return ok(await run());
  } catch (cause) {
    return err({ kind: "rpc", message: cause instanceof Error ? cause.message : String(cause), cause });
  }
}
