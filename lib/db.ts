import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function create() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set. Copy .env.example to .env and point it at Postgres.");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/**
 * Created on first use, so modules that import `db` can load (e.g. during
 * `next build`) before a database is connected.
 */
function client(): PrismaClient {
  return (globalForPrisma.prisma ??= create());
}

export const db = new Proxy({} as PrismaClient, {
  get(_, prop) {
    const c = client();
    const v = Reflect.get(c, prop, c);
    return typeof v === "function" ? v.bind(c) : v;
  },
});

export type { PrismaClient };
export * from "../generated/prisma/enums";
export { Prisma } from "../generated/prisma/client";
