import Database from "better-sqlite3";

/** Names of the migrations a database has finished applying, or null when it has none (no table yet). */
export function appliedMigrations(path: string): Set<string> | null {
  const db = new Database(path, { readonly: true });
  try {
    return new Set(db.prepare(`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL`).pluck().all() as string[]);
  } catch {
    return null;
  } finally {
    db.close();
  }
}
