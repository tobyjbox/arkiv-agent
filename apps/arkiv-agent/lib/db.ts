import { createPrisma, type Prisma } from "@arkiv-agent/db";

// One client per server process; dev hot reload would otherwise open a new one per edit.
const cache = globalThis as unknown as { arkivAgentPrisma?: Prisma };

export const prisma = cache.arkivAgentPrisma ?? createPrisma();
if (process.env.NODE_ENV !== "production") cache.arkivAgentPrisma = prisma;
