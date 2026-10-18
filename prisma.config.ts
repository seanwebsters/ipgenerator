import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  // Optional here so `prisma generate` (run on npm install) works before a
  // database is connected; migrate and the app check for it themselves.
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
