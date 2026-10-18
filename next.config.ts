import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["sharp", "@prisma/client", "pg"],
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  // Files the engine reads at runtime that the bundler can't see: the static
  // FFmpeg build (used on Vercel) and the bundled fonts.
  // Only the routes that run engine jobs inline need them.
  outputFileTracingIncludes: Object.fromEntries(
    ["/api/engine/tick", "/api/world/events"].map((route) => [route, ["./assets/fonts/**", "./node_modules/ffmpeg-static/ffmpeg"]]),
  ),
};

export default nextConfig;
