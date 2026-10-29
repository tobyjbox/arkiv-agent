import { createPrisma, indexStatus, type Prisma } from "@arkiv-agent/db";

// One client per server process; dev hot reload would otherwise open a new one per edit.
const cache = globalThis as unknown as { arkivAgentPrisma?: Prisma };

export const prisma = cache.arkivAgentPrisma ?? createPrisma();
if (process.env.NODE_ENV !== "production") cache.arkivAgentPrisma = prisma;

/**
 * Pages check this first: Next renders them alongside the layout, which shows how to build the index
 * instead, so without it they would still read the missing database and log errors (T21 M2).
 */
export const isIndexReady = () => indexStatus() === "ready";

/** For the APIs: a 503 that says what to do while the index isn't built, instead of a database error. */
export function indexNotReady(): Response | null {
  return isIndexReady() ? null : Response.json({ error: "The index isn't built yet. Run pnpm index." }, { status: 503 });
}
