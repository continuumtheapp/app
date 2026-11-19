import type { MetadataRoute } from "next";

/** Lets phones add SimbaCasa to the home screen with its own icon and colours. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SimbaCasa",
    short_name: "SimbaCasa",
    description: "Short-term housing, shared within our community.",
    start_url: "/",
    display: "standalone",
    background_color: "#fdfcfa",
    theme_color: "#014e4b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
