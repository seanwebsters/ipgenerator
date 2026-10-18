import { AsyncLocalStorage } from "node:async_hooks";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaPGlite } from "pglite-prisma-adapter";
import { PrismaClient } from "../generated/prisma/client";

/**
 * With DATABASE_URL: Postgres via node-postgres.
 * Without it: a built-in, in-memory Postgres (PGlite) so the app is fully
 * usable with no setup. It is migrated and seeded on first use, and its data
 * lasts only as long as the server process (see `embeddedDb`).
 */
export const embeddedDb = () => !process.env.DATABASE_URL;
export const DEMO_FOUNDER = { email: "founder@webster.studio", password: "webster-demo" };

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const seeding = new AsyncLocalStorage<true>();

function create(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString) return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  // Built-in database. PGlite runs queries in the order they are issued, so
  // the migrations queued here run before anything else.
  const pg = new PGlite();
  const migrated = pg.exec(migrationSql());
  const base = new PrismaClient({ adapter: new PrismaPGlite(pg) });
  let ready: Promise<void> | undefined;
  const seed = async () => {
    await migrated;
    const { seedStudio } = await import("./seed");
    await seedStudio({ ...DEMO_FOUNDER, name: "Founder (demo)" });
  };
  // Every operation waits for the seed; the seed's own queries skip the wait.
  return base.$extends({
    query: {
      async $allOperations({ args, query }) {
        if (!seeding.getStore()) await (ready ??= seeding.run(true, seed));
        return query(args);
      },
    },
  }) as unknown as PrismaClient;
}

function migrationSql(): string {
  const dir = path.join(process.cwd(), "prisma", "migrations");
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .map((m) => readFileSync(path.join(dir, m, "migration.sql"), "utf8"))
    .join("\n");
}

/**
 * Created on first use, so modules that import `db` can load (e.g. during
 * `next build`) before anything connects.
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
