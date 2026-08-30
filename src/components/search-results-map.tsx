"use client";

import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import type { MapPin } from "./listings-map";

// Loaded lazily so MapLibre stays out of the server bundle entirely.
const ListingsMap = dynamic(() => import("./listings-map").then((m) => m.ListingsMap), {
  ssr: false,
  loading: () => <div className="size-full rounded-xl border border-line bg-paper animate-pulse" />,
});
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
