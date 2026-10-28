import { describe, expect, it } from "vitest";
import { syncState } from "./sync-state";

describe("syncState (T15 R6)", () => {
  it("calls a reachable server with an idle index 'stale', not 'offline'", () => {
    expect(syncState(600, 3, false)).toBe("stale");
  });
  it("is 'offline' only when ArkivAgent's own server stops answering", () => {
    expect(syncState(600, 200, false)).toBe("offline");
    expect(syncState(null, 3, false)).toBe("offline");
  });
  it("is live, behind or delayed while the index moves", () => {
    expect(syncState(3, 3, false)).toBe("live");
    expect(syncState(3, 3, true)).toBe("behind");
    expect(syncState(40, 3, false)).toBe("delayed");
  });
});
