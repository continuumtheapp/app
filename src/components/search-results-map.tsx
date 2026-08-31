"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { MapPin } from "./listings-map";

// Loaded lazily so MapLibre stays out of the server bundle entirely.
const ListingsMap = dynamic(() => import("./listings-map").then((m) => m.ListingsMap), {
  ssr: false,
  loading: () => <div className="size-full rounded-xl border border-line bg-paper animate-pulse" />,
});

/** Tailwind's lg breakpoint, where the sidebar map appears. */
const DESKTOP_QUERY = "(min-width: 1024px)";
import type { ResultListing } from "@/lib/search";
import type { NearMiss } from "@/lib/matching";

export function SearchResultsMap({
  exact,
  nearMisses,
}: {
  exact: ResultListing[];
  nearMisses: (ResultListing & { near: NearMiss })[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  // The parent hides this below lg with CSS, but a hidden map still mounts and
  // builds its own markers — which on a phone duplicated every pin against the
  // full-screen map. Only mount it when the viewport is actually desktop.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  if (!isDesktop) return null;

  const pins: MapPin[] = [
    ...exact.map((l) => toPin(l, false)),
    ...nearMisses.map((l) => toPin(l, true)),
  ];

  return (
    <ListingsMap
      pins={pins}
      className="size-full"
      onSearchArea={(b) => {
        const next = new URLSearchParams(params);
        next.set("bbox", `${b.south},${b.west},${b.north},${b.east}`);
        router.push(`/search?${next}`);
      }}
    />
  );
}

function toPin(l: ResultListing, isNearMiss: boolean): MapPin {
  return {
    id: l.id, lat: l.lat, lng: l.lng, title: l.title,
    priceCents: l.priceCents, pricePeriod: l.pricePeriod, isNearMiss,
  };
}
