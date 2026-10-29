import { describe, expect, it } from "vitest";
import { isNumber, parseNumber, stem, tokenize, words } from "../../src/interpret/tokens.ts";

describe("tokenize", () => {
  it("drops surrounding punctuation and keeps quoted text as one unstemmed token", () => {
    expect(tokenize('show "State drug labs" records, please?').map((t) => [t.raw, t.stem, t.quoted])).toEqual([
      ["show", "show", false], ["State drug labs", "state drug labs", true], ["records", "record", false], ["please", "please", false],
    ]);
  });

  it("skips tokens that are only punctuation", () => {
    expect(tokenize("salaries ? !").map((t) => t.raw)).toEqual(["salaries"]);
  });
});

describe("stem", () => {
  it.each([["cities", "city"], ["batches", "batch"], ["challenges", "challenge"], ["exceeds", "exceed"], ["exceed", "exceed"], ["reported", "report"], ["status", "status"]])(
    "%s → %s", (w, s) => expect(stem(w)).toBe(s));
});

describe("words and numbers", () => {
  it("splits camelCase, snake_case and dashes", () => expect(words("lenderType_v2-x")).toEqual(["lender", "type", "v2", "x"]));
  it("reads digits, separators, k/m suffixes and number words", () => {
    expect([parseNumber("1,500"), parseNumber("1.5k"), parseNumber("2m"), parseNumber("ten"), parseNumber("-5")]).toEqual([1500, 1500, 2_000_000, 10, -5]);
    expect([isNumber("abc"), isNumber("12x"), isNumber("hundred")]).toEqual([false, false, true]);
  });
});
