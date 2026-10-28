import { execFileSync } from "node:child_process";
import { closeSync, openSync, readFileSync, rmSync, writeSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "@arkiv-agent/db";

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

/** Applies pending Prisma migrations (after the lock, so no other writer holds the database). */
export function migrate(): void {
  execFileSync(join(repoRoot(), "packages/db/node_modules/.bin/prisma"), ["migrate", "deploy"], {
    cwd: join(repoRoot(), "packages/db"), stdio: ["ignore", "ignore", "inherit"],
  });
}
