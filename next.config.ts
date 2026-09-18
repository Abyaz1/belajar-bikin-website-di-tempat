import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build menghasilkan .next/standalone/server.js untuk image Cloud Run.
  output: "standalone",
  // SDK Google dimuat langsung dari node_modules, tidak di-bundle. pg dan sharp
  // sudah termasuk daftar bawaan Next.js.
  serverExternalPackages: [
    "@google-cloud/cloud-sql-connector",
    "@google-cloud/storage",
    "@google/genai",
  ],
};

export default nextConfig;
