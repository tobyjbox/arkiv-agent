import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readAggregate, writeAggregates } from "../src/aggregates.ts";
import { openSqlite } from "../src/sqlite.ts";

const MIGRATIONS = join(import.meta.dirname, "../prisma/migrations");
const emptyDb = () => openSqlite(join(mkdtempSync(join(tmpdir(), "arkiv-agent-agg-")), "arkiv-agent.db"));
function migratedDb() {
  const db = emptyDb();
  for (const dir of readdirSync(MIGRATIONS).filter((d) => !d.endsWith(".toml")).sort()) db.exec(readFileSync(join(MIGRATIONS, dir, "migration.sql"), "utf8"));
  return db;
}

describe("stored aggregates", () => {
  it("reads null before the indexer has stored anything, or before the table exists", () => {
    expect(readAggregate("pulse:30:apps", migratedDb())).toBeNull();
    expect(readAggregate("pulse:30:apps", emptyDb())).toBeNull();
  });

  it("stores JSON values with the block they came from, and replaces them on the next refresh", () => {
    const db = migratedDb();
    writeAggregates([["a", { n: 1, list: [1, 2] }], ["b", null]], 100, db);
    expect(readAggregate("a", db)).toMatchObject({ value: { n: 1, list: [1, 2] }, indexedBlock: 100 });
    expect(readAggregate("b", db)?.value).toBeNull();
    writeAggregates([["a", { n: 2 }]], 101, db);
    expect(readAggregate("a", db)).toMatchObject({ value: { n: 2 }, indexedBlock: 101 });
    expect(readAggregate("b", db)?.indexedBlock).toBe(100);
  });

  it("writes a refresh all or nothing", () => {
    const db = migratedDb();
    const bad = { toJSON: () => { throw new Error("boom"); } };
    expect(() => writeAggregates([["a", 1], ["b", bad]], 5, db)).toThrow("boom");
    expect(readAggregate("a", db)).toBeNull();
  });
});
