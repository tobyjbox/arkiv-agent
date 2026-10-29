import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it, vi } from "vitest";
import { defaultDatabase } from "../src/path.ts";

const dir = () => mkdtempSync(join(tmpdir(), "arkiv-agent-path-"));
/** An index in WAL mode, as the indexer leaves it, with one row. */
function oldIndex(path: string) {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec("CREATE TABLE t(x); INSERT INTO t VALUES (1)");
  return db;
}

describe("defaultDatabase: the one-time move from the old file name", () => {
  it("moves an old index nothing has open, with its data, and leaves it in WAL mode", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const d = dir();
    oldIndex(join(d, "arkiv-agent.db")).close();
    expect(defaultDatabase(d)).toBe(join(d, "arkiv-agent.db"));
    expect(existsSync(join(d, "arkiv-agent.db"))).toBe(false);
    const db = new Database(join(d, "arkiv-agent.db"));
    expect(db.prepare("SELECT x FROM t").pluck().get()).toBe(1);
    expect(db.pragma("journal_mode", { simple: true })).toBe("wal");
    db.close();
  });

  it("leaves an index another connection has open where it is, and holds it there for this process", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const d = dir();
    const other = oldIndex(join(d, "arkiv-agent.db"));
    expect(defaultDatabase(d)).toBe(join(d, "arkiv-agent.db"));
    expect(existsSync(join(d, "arkiv-agent.db"))).toBe(false);
    other.close();
    expect(defaultDatabase(d)).toBe(join(d, "arkiv-agent.db")); // fixed for the process
    const probe = new Database(join(d, "arkiv-agent.db"));
    expect(() => probe.pragma("journal_mode = DELETE")).toThrow(/locked|busy/i); // the pin keeps others from moving it
    probe.close();
  });

  it("uses the new name when there's no old index, or when both exist", () => {
    const fresh = dir();
    expect(defaultDatabase(fresh)).toBe(join(fresh, "arkiv-agent.db"));
    const both = dir();
    writeFileSync(join(both, "arkiv-agent.db"), "");
    writeFileSync(join(both, "arkiv-agent.db"), "");
    expect(defaultDatabase(both)).toBe(join(both, "arkiv-agent.db"));
    expect(existsSync(join(both, "arkiv-agent.db"))).toBe(true);
  });
});
