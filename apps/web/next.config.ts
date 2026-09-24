import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["bullmq", "ioredis", "@react-pdf/renderer"],
};

export default nextConfig;
