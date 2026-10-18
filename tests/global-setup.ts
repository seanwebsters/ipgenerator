import { execSync } from "node:child_process";

/** Integration tests run against a dedicated database (TEST_DATABASE_URL). */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://webster:webster@localhost:5432/webster_test";
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "inherit" });
}
