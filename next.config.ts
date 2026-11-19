import type { NextConfig } from "next";
import { lanAddresses } from "./src/lib/lan";

const nextConfig: NextConfig = {
  // Lets a phone on the same Wi-Fi open the dev server at this computer's
  // address (e.g. http://192.168.178.114:4000). Dev only.
  allowedDevOrigins: lanAddresses(),
  images: {
    // Photos are served from R2 through Cloudflare Image Transformations,
    // not Next's optimiser.
    unoptimized: true,
  },
};

export default nextConfig;
