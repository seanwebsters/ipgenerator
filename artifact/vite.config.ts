import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "node:path";

const r = (p: string) => path.resolve(__dirname, p);

// Single self-contained HTML build of the app, for hosting as a private claude.ai page.
export default defineConfig({
  root: r("."),
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: [
      { find: /^next\/link$/, replacement: r("shims/router.tsx") },
      { find: /^next\/navigation$/, replacement: r("shims/router.tsx") },
      { find: /^server-only$/, replacement: r("shims/empty.ts") },
      { find: /^@\//, replacement: r("..") + "/" },
    ],
  },
  css: { postcss: r("..") },
  define: { "process.env": "{}" },
  build: { outDir: r("dist"), emptyOutDir: true, chunkSizeWarningLimit: 8000, assetsInlineLimit: 100_000_000 },
  logLevel: "warn",
});
