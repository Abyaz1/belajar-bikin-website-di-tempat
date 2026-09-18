import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build menghasilkan .next/standalone/server.js untuk image Cloud Run.
  output: "standalone",
};

export default nextConfig;
