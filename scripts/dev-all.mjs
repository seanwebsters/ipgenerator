// Runs the web app and one engine worker together for local development.
import { spawn } from "node:child_process";

const procs = [
  spawn("npx", ["next", "dev"], { stdio: "inherit" }),
  spawn("npx", ["tsx", "engine/worker.ts"], { stdio: "inherit" }),
];
const stop = () => procs.forEach((p) => p.kill("SIGTERM"));
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const p of procs) p.on("exit", (code) => code && stop());
