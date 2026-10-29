import { execFileSync } from "node:child_process";
import { closeSync, existsSync, openSync, readdirSync, readFileSync, rmSync, writeSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { databasePath, databaseUrl, repoRoot } from "@arkiv-agent/db";

const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/** One indexer per database: a second would race the first for the cursor. Stale locks are taken over. */
export function acquireIndexerLock(dbPath: string): void {
  const path = `${dbPath}.indexer.lock`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(path, "wx");
      writeSync(fd, String(process.pid));
      closeSync(fd);
      const release = () => rmSync(path, { force: true });
      process.on("exit", release);
      for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => process.exit(130));
      return;
    } catch {
      const pid = Number(readFileSync(path, "utf8"));
      if (isAlive(pid)) throw new Error(`Another indexer (pid ${pid}) is using this database. Stop it first, or let it run.`);
      rmSync(path, { force: true });
    }
  }
}

/** Migrations in the repo that the database has not applied yet (all of them for a new database). */
function pendingMigrations(): string[] {
  const dir = join(repoRoot(), "packages/db/prisma/migrations");
  const all = readdirSync(dir).filter((d) => existsSync(join(dir, d, "migration.sql")));
  if (!existsSync(databasePath())) return all;
  const db = new Database(databasePath(), { readonly: true });
  try {
    const applied = new Set(db.prepare(`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL`).pluck().all() as string[]);
    return all.filter((m) => !applied.has(m));
  } catch {
    return all;
  } finally {
    db.close();
  }
}

/**
 * Applies pending Prisma migrations, under the lock. Prisma needs the database to itself, so this
 * only runs when something is pending; then the app (`pnpm dev`) must be stopped for a moment.
 */
export function migrate(): void {
  const pending = pendingMigrations();
  if (!pending.length) return;
  console.log(`applying ${pending.length} migration(s): ${pending.join(", ")}`);
  try {
    // The path this process settled on (databasePath may have moved an old index), so Prisma can't pick another.
    execFileSync(join(repoRoot(), "packages/db/node_modules/.bin/prisma"), ["migrate", "deploy"], {
      cwd: join(repoRoot(), "packages/db"), stdio: ["ignore", "ignore", "inherit"], env: { ...process.env, DATABASE_URL: databaseUrl() },
    });
  } catch {
    throw new Error("Could not apply the database migration: the database is in use. Stop the app (pnpm dev / start) for a moment, run the indexer again, then restart the app.");
  }
}
