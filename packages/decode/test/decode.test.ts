import type { Dataset, Member } from "@arkiv-agent/catalogue";
import { describe, expect, it } from "vitest";
import { assembleDecode } from "../src/assemble.ts";
import { inferLinks, type Target } from "../src/links.ts";
import { conventions, sharedBuilders, sharedShapes } from "../src/patterns.ts";
import { isSealed, privacyFlags } from "../src/privacy.ts";
import { classifyPurpose } from "../src/purpose.ts";

const key = (n: number) => `0x${n.toString(16).padStart(64, "0")}`;
const member = (n: number, owner: string, attrs: Record<string, [Member["attrs"] extends ReadonlyMap<string, infer A> ? A extends { type: infer T } ? T : never : never, string]>, status: Member["status"] = "live"): Member => ({
  key: key(n), owner, status, createdAtBlock: 1, updatedAtBlock: 1, expiresAt: 100, contentType: null, payloadBytes: null,
  attrs: new Map(Object.entries(attrs).map(([name, [type, value]]) => [name, { type, value }])),
});

describe("inferLinks", () => {
  const members = new Map<string, Member[]>([
    ["orders", [member(1, "0xa", { customer: ["key", key(10)] }), member(2, "0xa", { customer: ["key", key(11)] }), member(3, "0xa", { customer: ["key", key(99)], note: ["str", key(10)], hash: ["bytes32", key(500)] })]],
    ["customers", [member(10, "0xb", {}), member(11, "0xb", {}, "expired")]],
  ]);
  const known = new Map<string, Target>([[key(10), { datasetId: "customers", owner: "0xb", isLive: true }], [key(11), { datasetId: "customers", owner: "0xb", isLive: false }]]);
  const edges = inferLinks(members, (k) => known.get(k) ?? null);
  const find = (attr: string, to: string | null) => edges.find((e) => e.attr === attr && e.to === to);

  it("groups key attributes by target dataset and counts broken and cross-wallet links", () => {
    expect(find("customer", "customers")).toMatchObject({ count: 2, broken: 1, crossWallet: 2, isImplicit: false });
  });
  it("counts a key that leads nowhere as a broken link outside the catalogue", () => {
    expect(find("customer", null)).toMatchObject({ count: 1, broken: 1 });
  });
  it("takes key-shaped text as a link only when the key exists", () => {
    expect(find("note", "customers")).toMatchObject({ count: 1, isImplicit: true });
    expect(edges.some((e) => e.attr === "hash")).toBe(false);
  });
});

describe("classifyPurpose", () => {
  it("picks the archetype most words point at, with the evidence", () => {
    const p = classifyPurpose(["example_marketplace", "listing", "sellerAddr", "price", "orders"]);
    expect(p.archetype).toBe("marketplace");
    expect(p.evidence).toEqual(expect.arrayContaining(["listing", "seller", "price", "order"]));
  });
  it("says unclear on one matching word", () => {
    expect(classifyPurpose(["price", "foo_id"]).archetype).toBe("unclear");
  });
});

describe("privacyFlags", () => {
  it("flags by attribute name, and wallets by a person's role", () => {
    const flags = privacyFlags([{ name: "patient_phone", type: "str" }, { name: "rider", type: "addr" }, { name: "gh7", type: "str" }, { name: "count", type: "i32" }]);
    expect(flags.map((f) => f.category).sort()).toEqual(["contact", "location", "person", "personal wallet"]);
  });
  it("does not flag a word inside another word", () => {
    expect(privacyFlags([{ name: "company", type: "str" }, { name: "plate", type: "str" }])).toEqual([]);
  });
  it("knows sealed content types", () => {
    expect(isSealed(["application/vnd.arkiv.encrypted.v1"])).toBe(true);
    expect(isSealed(["application/json"])).toBe(false);
    expect(isSealed([])).toBe(false);
  });
});

describe("patterns", () => {
  const f = (name: string, type = "str") => ({ name, type });
  const datasets = [
    { id: "d1", project: "label:a", fields: [f("v", "i32"), f("kind"), f("at", "u64")], writers: ["0x1"] },
    { id: "d2", project: "label:b", fields: [f("v", "i32"), f("kind"), f("at", "u64")], writers: ["0x1", "0x2"] },
    { id: "d3", project: "label:c", fields: [f("v", "u64"), f("random_*")], writers: ["0x3"] },
  ];
  it("ranks shared attribute names and reports type conflicts", () => {
    const v = conventions(datasets).find((c) => c.name === "v");
    expect(v).toMatchObject({ projects: 3, types: [{ type: "i32", projects: 2 }, { type: "u64", projects: 1 }] });
  });
  it("finds the same shape under two projects", () => {
    expect(sharedShapes(datasets)).toEqual([{ fields: ["at:u64", "kind:str", "v:i32"], projects: ["label:a", "label:b"], datasets: ["d1", "d2"] }]);
  });
  it("pairs projects that share a wallet", () => {
    expect(sharedBuilders(datasets)).toEqual({ pairs: [{ a: "label:a", b: "label:b", wallets: 1 }], wallets: 1 });
  });
});

describe("assembleDecode", () => {
  const dataset = (id: string, label: string, fields: string[], isLoadGenerator = false): Dataset => ({
    id, name: id, nameSource: "discriminator", discriminator: { name: "kind", value: id }, shape: null, unqueryable: null,
    project: { label, method: "label", labelAttr: "app", isPrefix: false, confidence: 0.9, conflictWallets: null },
    schema: fields.map((name) => ({ name, type: name === "buyer" ? "key" : "str", presence: 1, examples: [] })),
    liveCount: 1, writers: 1, ownership: "app", medianLifetimeBlocks: 100, firstWriteBlock: 1, lastWriteBlock: 1, writes24h: 0, hourly24h: [],
    contentTypes: [], medianPayloadBytes: null, isLoadGenerator, soleOwner: null,
  });
  const membersById = new Map([["orders", [member(1, "0xa", { buyer: ["key", key(2)] })]], ["buyers", [member(2, "0xb", {})]], ["noise", [member(3, "0xl", {})]]]);
  const d = assembleDecode({
    datasets: [dataset("orders", "shop", ["price", "seller", "buyer"]), dataset("buyers", "crm", ["email"]), dataset("noise", "load", ["x"], true)],
    membersById, indexedBlock: 5,
    resolve: (k) => (k === key(2) ? { datasetId: "buyers", owner: "0xb", isLive: true } : null),
  });
  it("leaves load generators out and counts a link between projects", () => {
    expect(d.summary).toMatchObject({ projects: 2, datasets: 2, refs: 1, resolved: 1, broken: 0, crossProject: 1, flaggedDatasets: 1 });
  });
  it("draws projects, datasets and the link for the graph", () => {
    expect(d.nodes.map((n) => n.id).sort()).toEqual(["buyers", "label:crm", "label:shop", "orders"]);
    expect(d.links).toContainEqual({ source: "orders", target: "buyers", kind: "ref", count: 1, broken: 0 });
  });
});
