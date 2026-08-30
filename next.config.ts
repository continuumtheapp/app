import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Photos are served from R2 through Cloudflare Image Transformations,
    // not Next's optimiser.
    unoptimized: true,
  },
};

export default nextConfig;
