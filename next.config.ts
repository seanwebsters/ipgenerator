import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["sharp", "@prisma/client", "pg"],
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
};

export default nextConfig;
