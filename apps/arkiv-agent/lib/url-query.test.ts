import { describe, expect, it } from "vitest";
import { withQuery } from "./url-query";

describe("withQuery", () => {
  it("sets and removes params, keeping the others", () => {
    expect(withQuery("?writes=5&unit=days", { range: "90" })).toBe("?writes=5&unit=days&range=90");
    expect(withQuery("?range=90&writes=5", { writes: "6", range: null })).toBe("?writes=6");
    expect(withQuery("?load=1", { writes: "5" })).toBe("?load=1&writes=5");
  });

  it("returns an empty string when no params are left", () => {
    expect(withQuery("?range=7", { range: null })).toBe("");
    expect(withQuery("", { range: null })).toBe("");
  });
});
