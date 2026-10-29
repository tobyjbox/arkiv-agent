import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "./generated/prisma/client.ts";
import { databaseUrl } from "./path.ts";

/** Typed reader for the app and tests. */
export function createPrisma(url = databaseUrl()) {
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}

export type Prisma = ReturnType<typeof createPrisma>;
