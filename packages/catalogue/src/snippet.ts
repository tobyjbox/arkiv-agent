import { addr, str } from "@arkiv-network/sdk/attr";
import { and, eq, exists, type Expression, render, startsWith } from "@arkiv-network/sdk/query";
import type { Dataset } from "./types.ts";

/** One condition, as an SDK expression and as the SDK code that builds it. */
export type Predicate = { expr: Expression; code: string };

/**
 * The query that reads a dataset back from Arkiv, as SDK code and as the query string the node
 * parses (rendered by the SDK itself, so it is exact). Generated names (`*`) cannot be queried.
 */
export function datasetPredicates(d: Pick<Dataset, "project" | "discriminator" | "schema" | "soleOwner">): Predicate[] {
  const out: Predicate[] = [];
  const { project } = d;
  if (project.method === "label" && project.labelAttr) {
    const value = project.isPrefix ? project.label.replace(/\*$/, "") : project.label;
    out.push(project.isPrefix
      ? { expr: startsWith(project.labelAttr, value), code: `startsWith(${JSON.stringify(project.labelAttr)}, ${JSON.stringify(value)})` }
      : { expr: eq(project.labelAttr, str(value)), code: `eq(${JSON.stringify(project.labelAttr)}, str(${JSON.stringify(value)}))` });
  }
  const owner = project.method === "creator" ? project.label : null;
  if (owner) out.push({ expr: eq("$owner", addr(owner as `0x${string}`)), code: `eq("$owner", addr(${JSON.stringify(owner)}))` });
  if (d.discriminator) {
    out.push({ expr: eq(d.discriminator.name, str(d.discriminator.value)), code: `eq(${JSON.stringify(d.discriminator.name)}, str(${JSON.stringify(d.discriminator.value)}))` });
  } else {
    const always = d.schema.filter((f) => f.presence === 1 && !f.name.includes("*") && f.name !== project.labelAttr).slice(0, 2);
    for (const f of always) out.push({ expr: exists(f.name), code: `exists(${JSON.stringify(f.name)})` });
  }
  return out;
}

export function datasetSnippet(d: Parameters<typeof datasetPredicates>[0]): { typescript: string; query: string } {
  return querySnippet(datasetPredicates(d));
}

const QUERY_FNS = ["and", "or", "not", "eq", "ne", "gt", "gte", "lt", "lte", "exists", "startsWith"];
const VALUE_FNS = ["str", "addr", "i32", "u64", "u256", "dec", "key", "bytes32"];

/** Read-only SDK code and the node's query string for predicates that must all hold. */
export function querySnippet(preds: Predicate[], limit = 50): { typescript: string; query: string } {
  if (!preds.length) return { typescript: "// This dataset has no queryable attributes.", query: "" };
  const query = render(preds.length === 1 ? preds[0]!.expr : and(preds.map((p) => p.expr)));
  const where = preds.length === 1 ? preds[0]!.code : `and(\n      ${preds.map((p) => p.code).join(",\n      ")},\n    )`;
  const uses = (f: string) => new RegExp(`(^|[^\\w$])${f}\\(`).test(where);
  const fns = QUERY_FNS.filter(uses);
  const attrFns = VALUE_FNS.filter(uses);
  const typescript = `import { createPublicClient } from "@arkiv-network/sdk";
${attrFns.length ? `import { ${attrFns.join(", ")} } from "@arkiv-network/sdk/attr";\n` : ""}import { tiramisu } from "@arkiv-network/sdk/chains";
import { ${fns.join(", ")} } from "@arkiv-network/sdk/query";
import { http } from "viem";

const client = createPublicClient({ chain: tiramisu, transport: http() });
const head = await client.getBlockNumber();

// Pin the block: on SDK 0.8.1, page.next() fails unless every page reads the same block.
const page = await client
  .select({ key: true, owner: true, attributes: true, payload: true })
  .where(${where})
  .atBlock(head)
  .limit(${limit})
  .fetch();

console.log(page.entities.length, "records; more:", page.hasNextPage());
`;
  return { typescript, query };
}
