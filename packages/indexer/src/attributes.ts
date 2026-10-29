import { type Hex, hexToBytes, hexToString } from "viem";
import { TYPE_TAGS, type TypeTag } from "./abi.ts";

export type WireAttribute = { readonly name: Hex; readonly typeId: number; readonly value: Hex };
export type Attr = { type: Exclude<TypeTag, "bytes">; value: string };

/** An entity's decoded state: user attributes plus the two system cells. */
export type EntityState = { attrs: Map<string, Attr>; contentType: string | null; payload: Uint8Array | null };

export const emptyState = (): EntityState => ({ attrs: new Map(), contentType: null, payload: null });

const DEC_SCALE = 10n ** 18n;

function decimal(raw: bigint): string {
  const n = BigInt.asIntN(256, raw);
  const abs = n < 0n ? -n : n;
  const frac = (abs % DEC_SCALE).toString().padStart(18, "0").replace(/0+$/, "");
  return `${n < 0n ? "-" : ""}${abs / DEC_SCALE}${frac ? `.${frac}` : ""}`;
}

/** Canonical text for a word or string value, per its tag (sdk src/attr/codec.ts decodeValueBytes). */
export function valueText(tag: Exclude<TypeTag, "bytes">, value: Hex): string {
  if (tag === "str") return hexToString(value);
  const raw = BigInt(value);
  switch (tag) {
    case "bool": return raw === 1n ? "true" : "false";
    case "i32": return BigInt.asIntN(32, raw).toString();
    case "u64": case "u256": return raw.toString();
    case "dec": return decimal(raw);
    case "addr": return `0x${value.slice(-40).toLowerCase()}`;
    case "bytes32": case "key": return value.toLowerCase();
  }
}

/** Applies create attributes or patch mutations to a state, in order. Tombstones unset. */
export function applyWire(state: EntityState, wire: readonly WireAttribute[]): EntityState {
  for (const { name: rawName, typeId, value } of wire) {
    const name = hexToString(rawName, { size: 32 }).replace(/\0+$/, "");
    if (name === "$payload") state.payload = typeId === 0 ? null : hexToBytes(value);
    else if (name === "$contentType") state.contentType = typeId === 0 ? null : hexToString(value);
    else if (typeId === 0) state.attrs.delete(name);
    else {
      const tag = TYPE_TAGS[typeId as keyof typeof TYPE_TAGS];
      if (!tag || tag === "bytes") throw new Error(`unknown attribute typeId ${typeId} for "${name}"`);
      state.attrs.set(name, { type: tag, value: valueText(tag, value) });
    }
  }
  return state;
}

/** Dataset grouping key: the sorted attribute names and types, values ignored. */
export const schemaSig = (attrs: Map<string, Attr>) =>
  [...attrs].map(([name, a]) => `${name}:${a.type}`).sort().join(",");

const PREVIEW_BYTES = 256;
const utf8 = new TextDecoder("utf-8", { fatal: true });

/** A short preview (privacy: never the whole payload): UTF-8 text if it is text, else hex. */
export function payloadPreview(payload: Uint8Array): string {
  const head = payload.subarray(0, PREVIEW_BYTES);
  try {
    return utf8.decode(payload.length > PREVIEW_BYTES ? head.subarray(0, lastCharBoundary(head)) : head);
  } catch {
    return `0x${Buffer.from(head.subarray(0, PREVIEW_BYTES / 2)).toString("hex")}`;
  }
}

/** Cut before a trailing partial UTF-8 sequence so a truncated preview still decodes. */
function lastCharBoundary(bytes: Uint8Array): number {
  for (let i = bytes.length - 1; i >= Math.max(0, bytes.length - 4); i--) {
    const b = bytes[i]!;
    if ((b & 0xc0) === 0x80) continue;
    const len = b < 0x80 ? 1 : b >= 0xf0 ? 4 : b >= 0xe0 ? 3 : 2;
    return i + len <= bytes.length ? bytes.length : i;
  }
  return bytes.length;
}

/** An entity's state from an SDK read (`getEntity`), in the same canonical text as calldata decoding. */
export function stateFromSdk(entity: { attributes?: Readonly<Record<string, { type: string; value: unknown }>> | undefined; payload?: Uint8Array | undefined; contentType?: string | undefined }): EntityState {
  const attrs = new Map<string, Attr>();
  for (const [name, v] of Object.entries(entity.attributes ?? {})) {
    if (v.type === "bytes" || !Object.values(TYPE_TAGS).includes(v.type as TypeTag)) continue;
    const text = typeof v.value === "string" ? v.value : String(v.value);
    attrs.set(name, { type: v.type as Attr["type"], value: ["addr", "bytes32", "key"].includes(v.type) ? text.toLowerCase() : text });
  }
  return { attrs, contentType: entity.contentType ?? null, payload: entity.payload ?? null };
}

/**
 * Where the index's attributes differ from the chain's for one entity, as `name:type=value` lines,
 * with chain values normalized as the indexer stores them. Both empty when they match.
 */
export function attributeDiff(chain: Parameters<typeof stateFromSdk>[0], ours: readonly { name: string; type: string; value: string }[]) {
  const theirs = [...stateFromSdk(chain).attrs].map(([name, a]) => `${name}:${a.type}=${a.value}`);
  const mine = ours.map((a) => `${a.name}:${a.type}=${a.value}`);
  return { chainOnly: theirs.filter((c) => !mine.includes(c)).sort(), indexOnly: mine.filter((o) => !theirs.includes(o)).sort() };
}
