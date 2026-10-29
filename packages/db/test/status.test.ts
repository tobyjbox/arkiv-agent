import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { indexStatus } from "../src/status.ts";

describe("indexStatus (T21 M2)", () => {
  const dir = mkdtempSync(join(tmpdir(), "arkiv-agent-status-"));

  it("reports a missing index without creating the file", () => {
    const path = join(dir, "missing.db");
    expect(indexStatus(path)).toBe("missing");
    expect(existsSync(path)).toBe(false);
  });

  it("reports an index whose tables aren't there yet, then a ready one", () => {
    const path = join(dir, "arkiv-agent.db");
    const db = new Database(path);
    db.exec(`CREATE TABLE "Entity" (key TEXT); CREATE TABLE "SyncState" (id INTEGER)`);
    expect(indexStatus(path)).toBe("incomplete");
    db.exec(`CREATE TABLE "Attribute" (x); CREATE TABLE "Patch" (x); CREATE TABLE "Change" (x); CREATE TABLE "TxFee" (x)`);
    db.close();
    expect(indexStatus(path)).toBe("ready");
  });
});
