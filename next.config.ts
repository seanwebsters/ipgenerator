import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["sharp", "@prisma/client", "pg", "@electric-sql/pglite", "pglite-prisma-adapter"],
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  // Files read at runtime that the bundler can't see: the static FFmpeg build
  // (used on Vercel), the bundled fonts, and the migrations and PGlite assets
  // for the built-in database. Every route gets the same set so they stay in
  // one Vercel function (and so share one built-in database).
  outputFileTracingIncludes: {
    "/**": [
      "./assets/fonts/**",
      "./node_modules/ffmpeg-static/ffmpeg",
      "./prisma/migrations/**",
      "./node_modules/@electric-sql/pglite/dist/*.{wasm,data,js,cjs}",
    ],
  },
};

export default nextConfig;
