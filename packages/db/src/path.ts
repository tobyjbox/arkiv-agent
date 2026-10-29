import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

/** The pnpm workspace root, found by walking up from the current directory. */
export function repoRoot(from = process.cwd()): string {
  for (let dir = resolve(from); ; dir = dirname(dir)) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    if (dirname(dir) === dir) throw new Error(`No pnpm-workspace.yaml above ${from}`);
  }
}

/** Absolute SQLite path: DATABASE_URL (`file:` path, relative to the repo root) or data/arkiv-agent.db. */
export function databasePath(): string {
  const root = repoRoot();
  try {
    process.loadEnvFile(join(root, ".env"));
  } catch {
    // no .env: defaults apply
  }
  const raw = (process.env.DATABASE_URL ?? "file:./data/arkiv-agent.db").replace(/^file:/, "");
  return raw === ":memory:" || isAbsolute(raw) ? raw : join(root, raw);
}

export const databaseUrl = () => `file:${databasePath()}`;
