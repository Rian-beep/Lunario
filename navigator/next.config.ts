import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  distDir: process.env.SOLARREACH_NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
