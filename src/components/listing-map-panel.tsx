"use client";

import dynamic from "next/dynamic";
import type { MapPin } from "./listings-map";

/**
 * Client-only wrapper around the map.
 *
 * MapLibre is a browser library — it touches window and WebGL and cannot run on
 * the server. Importing it from a server component pulls the whole library into
 * the server bundle (~5 MB), which blows the Workers size limit for no benefit.
 * `ssr: false` keeps it out of that bundle entirely.
 */
const ListingsMap = dynamic(
  () => import("./listings-map").then((m) => m.ListingsMap),
  {
    ssr: false,
    loading: () => (
      <div className="size-full rounded-xl border border-line bg-paper animate-pulse" />
    ),
  },
);

export function ListingMapPanel({ pins }: { pins: MapPin[] }) {
  return <ListingsMap pins={pins} className="size-full" />;
}
