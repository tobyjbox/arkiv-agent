import { toHex } from "viem";
import { describe, expect, it } from "vitest";
import { applyWire, attributeDiff, emptyState, payloadPreview, schemaSig, valueText } from "../src/attributes.ts";
import { name32, str, u64, unset } from "./helpers.ts";

const word = (n: bigint) => toHex(BigInt.asUintN(256, n), { size: 32 });

describe("valueText", () => {
  it("renders each word type canonically", () => {
    expect(valueText("bool", word(1n))).toBe("true");
    expect(valueText("i32", word(-7n))).toBe("-7");
    expect(valueText("u64", word(42n))).toBe("42");
    expect(valueText("dec", word(-1_500_000_000_000_000_000n))).toBe("-1.5");
    expect(valueText("dec", word(2n * 10n ** 18n))).toBe("2");
    expect(valueText("addr", word(0xabcdefn))).toBe("0x0000000000000000000000000000000000abcdef");
  });
});

describe("applyWire", () => {
  it("separates system cells and applies tombstones in order", () => {
    const cells = [str("$contentType", "text/plain"), str("$payload", "hi"), str("project", "arkiv-agent"), u64("n", 3n)];
    const state = applyWire(emptyState(), cells.map((c) => ({ ...c, name: name32(c.name) })));
    expect(state.contentType).toBe("text/plain");
    expect(new TextDecoder().decode(state.payload!)).toBe("hi");
    expect(schemaSig(state.attrs)).toBe("n:u64,project:str");
    applyWire(state, [unset("n")].map((c) => ({ ...c, name: name32(c.name) })));
    expect([...state.attrs.keys()]).toEqual(["project"]);
  });

  it("rejects an unknown typeId instead of guessing", () => {
    expect(() => applyWire(emptyState(), [{ name: name32("x"), typeId: 99, value: "0x" }])).toThrow(/typeId 99/);
  });
});

describe("payloadPreview", () => {
  it("keeps short text, cuts long text on a character boundary, and hex-encodes binary", () => {
    expect(payloadPreview(new TextEncoder().encode("hello"))).toBe("hello");
    const long = payloadPreview(new TextEncoder().encode(`${"a".repeat(255)}é tail`));
    expect(long).toBe("a".repeat(255));
    expect(payloadPreview(new Uint8Array([0xff, 0xfe, 0x00]))).toBe("0xfffe00");
  });
});

describe("attributeDiff (index:verify --attrs)", () => {
  const chain = { attributes: { city: { type: "str", value: "noida" }, ctc: { type: "i32", value: 1500000 }, owner: { type: "addr", value: "0xAbC0000000000000000000000000000000000001" } } };
  const ours = [
    { name: "city", type: "str", value: "noida" },
    { name: "ctc", type: "i32", value: "1500000" },
    { name: "owner", type: "addr", value: "0xabc0000000000000000000000000000000000001" },
  ];

  it("matches when names, types and values agree (addresses compared lowercased)", () => {
    expect(attributeDiff(chain, ours)).toEqual({ chainOnly: [], indexOnly: [] });
  });

  it("catches a value the decoder got wrong even when name and type are right", () => {
    const corrupted = ours.map((a) => (a.name === "ctc" ? { ...a, value: "1500001" } : a));
    expect(attributeDiff(chain, corrupted)).toEqual({ chainOnly: ["ctc:i32=1500000"], indexOnly: ["ctc:i32=1500001"] });
  });
});
