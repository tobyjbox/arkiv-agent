import { describe, expect, it } from "vitest";
import { glm, usd } from "./glm";

describe("usd", () => {
  it("shows cents, and significant digits below a cent", () => {
    expect(usd(1234.5)).toBe("$1,234.50");
    expect(usd(0.000123456)).toBe("$0.000123");
    expect(usd(0)).toBe("$0");
  });
});

describe("glm", () => {
  it("shows up to 4 significant digits, never in exponent form", () => {
    expect([glm(0), glm(11.23456), glm(0.0000123456)]).toEqual(["0", "11.23", "0.00001235"]);
  });
});
