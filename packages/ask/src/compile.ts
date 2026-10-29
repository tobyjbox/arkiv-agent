import { addr, bool, bytes32, dec, i32, key, str, u256, u64 } from "@arkiv-network/sdk/attr";
import { and, eq, type Expression, gt, gte, lt, lte, not, or, render, startsWith } from "@arkiv-network/sdk/query";
import { type Dataset, datasetPredicates, PRESENCE_TYPES, type Predicate, presence, querySnippet } from "@arkiv-agent/catalogue";
import { type Result, err, ok } from "@arkiv-agent/core";
import type { AskPlan, AskQuery, AttrType, Comparison } from "./query.ts";

const J = JSON.stringify;
const OPS = { eq, gt, gte, lt, lte } as const;
const HEX = /^0x[0-9a-fA-F]+$/;
const CROSS_DATASET = new Set(["$owner", "$creator", "$key"]);

/** Equality on owner, creator or key (or several of them): the only queries that run without a dataset. */
const isLookup = (q: AskQuery): boolean =>
  q.op === "and" || q.op === "or" ? q.terms.every(isLookup) : q.op === "eq" && CROSS_DATASET.has(q.attr);

/** The typed SDK value for a condition, and the code that builds it. Throws on a value the type can't hold. */
function typedValue(type: AttrType, v: string): { value: Parameters<typeof eq>[1]; code: string } {
  switch (type) {
    case "bool":
      if (v !== "true" && v !== "false") throw new Error(`"${v}" is not true or false`);
      return { value: bool(v === "true"), code: v };
    case "i32":
      if (!/^-?\d+$/.test(v)) throw new Error(`"${v}" is not a whole number`);
      return { value: i32(Number(v)), code: `i32(${v})` };
    case "u64":
    case "u256":
      if (!/^\d+$/.test(v)) throw new Error(`"${v}" is not a non-negative whole number`);
      return { value: type === "u64" ? u64(BigInt(v)) : u256(BigInt(v)), code: `${type}(${v}n)` };
    case "dec":
      return { value: dec(v), code: `dec(${J(v)})` };
    case "addr":
      return { value: addr(v), code: `addr(${J(v)})` };
    case "key":
    case "bytes32":
      if (!HEX.test(v)) throw new Error(`"${v}" is not hex`);
      return { value: type === "key" ? key(v as `0x${string}`) : bytes32(v as `0x${string}`), code: `${type}(${J(v)})` };
    case "str":
      return { value: str(v), code: `str(${J(v)})` };
  }
}

/** An `AskQuery` as an SDK expression and code. The SDK validates names, types and operators. */
export function toPredicate(q: AskQuery): Predicate {
  switch (q.op) {
    case "and":
    case "or": {
      const parts = q.terms.map(toPredicate);
      if (parts.length === 1) return parts[0]!;
      return { expr: (q.op === "and" ? and : or)(parts.map((p) => p.expr)), code: `${q.op}(${parts.map((p) => p.code).join(", ")})` };
    }
    case "not": {
      const inner = toPredicate(q.term);
      return { expr: not(inner.expr), code: `not(${inner.code})` };
    }
    case "startsWith":
      return { expr: startsWith(q.attr, q.value), code: `startsWith(${J(q.attr)}, ${J(q.value)})` };
    case "exists":
      // The SDK builds it, but Tiramisu's node rejects EXISTS (-32002): refuse rather than send it.
      throw new Error(`Arkiv's node doesn't support EXISTS queries yet, so "${q.attr}" can't be checked for presence.`);
    default: {
      const c = q as Comparison;
      const { value, code } = typedValue(c.type, c.value);
      if (c.op === "ne") {
        // Tiramisu rejects != (-32002), as it does EXISTS. "Is not" becomes NOT =, plus "has it" where
        // the type allows, so records without the attribute don't count as different.
        const neq = { expr: not(eq(c.attr, value)), code: `not(eq(${J(c.attr)}, ${code}))` };
        if (!PRESENCE_TYPES.has(c.type) || c.attr.startsWith("$")) return neq;
        const has = presence({ name: c.attr, type: c.type });
        return { expr: and([has.expr, neq.expr]), code: `and(${has.code}, ${neq.code})` };
      }
      return { expr: OPS[c.op](c.attr, value), code: `${c.op}(${J(c.attr)}, ${code})` };
    }
  }
}

export type Compiled = { expression: Expression; query: string; typescript: string };

/**
 * The plan's conditions ANDed with its dataset's own predicates, ready to run. Errors (a value the
 * attribute type can't hold, a name that can't exist) come back as a message: never run them.
 */
export function compile(plan: Pick<AskPlan, "where" | "limit">, dataset: Dataset | null): Result<Compiled, string> {
  // Across all datasets only who-wrote-it lookups run: anything else would scan the whole chain.
  if (!dataset && plan.where && !isLookup(plan.where)) {
    return err("Choose a dataset first: across all datasets Ask only looks up records by $owner, $creator or $key.");
  }
  if (dataset?.unqueryable) return err(`One query can't read ${dataset.name} back yet: ${dataset.unqueryable}`);
  try {
    const preds = [...(dataset ? datasetPredicates(dataset) : []), ...(plan.where ? [toPredicate(plan.where)] : [])];
    if (!preds.length) return err("The question has no conditions to query on.");
    const expression = preds.length === 1 ? preds[0]!.expr : and(preds.map((p) => p.expr));
    return ok({ expression, query: render(expression), typescript: querySnippet(preds, plan.limit).typescript });
  } catch (cause) {
    return err(cause instanceof Error ? cause.message : String(cause));
  }
}
