"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ListingsMap, type MapPin } from "./listings-map";
import { photoUrl } from "@/lib/photos";
import { formatPrice } from "@/lib/pricing";
import type { ResultListing } from "@/lib/search";
import type { NearMiss } from "@/lib/matching";

/**
 * Mobile map view: a floating pill over the results that opens a full-screen
 * map, with a card sliding up when a pin is tapped.
 *
 * A phone has no room for a side-by-side map, and a permanently visible one
 * would halve the space for results — which are the main content here. So the
 * map is a mode you enter, the way Airbnb does it.
 */
export function MobileMapToggle({
  exact,
  nearMisses,
}: {
  exact: ResultListing[];
  nearMisses: (ResultListing & { near: NearMiss })[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ResultListing | null>(null);

  const all = [...exact, ...nearMisses];
  const pins: MapPin[] = [
    ...exact.map((l) => toPin(l, false)),
    ...nearMisses.map((l) => toPin(l, true)),
  ];

  // Stop the page behind the map from scrolling while it's open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  // The hardware back button should close the map, not leave the results.
  useEffect(() => {
    if (!open) return;
    const onPop = (e: PopStateEvent) => { e.preventDefault(); setOpen(false); };
    window.history.pushState({ map: true }, "");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [open]);

  if (pins.length === 0) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-30
                   btn bg-ink text-white shadow-lg px-5 py-2.5"
      >
        <MapIcon />
        Map
      </button>
    );
  }

  return (
    <div className="lg:hidden fixed inset-0 z-50 bg-paper">
      <ListingsMap
        pins={pins}
        className="size-full"
        selectedId={selected?.id ?? null}
        onPinClick={(id) => setSelected(all.find((l) => l.id === id) ?? null)}
        onSearchArea={(b) => {
          const next = new URLSearchParams(params);
          next.set("bbox", `${b.south},${b.west},${b.north},${b.east}`);
          setOpen(false);
          router.push(`/search?${next}`);
        }}
      />

      <button
        type="button"
        onClick={() => setOpen(false)}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-10
                   btn bg-ink text-white shadow-lg px-5 py-2.5"
      >
        <ListIcon />
        List
      </button>

      {selected && (
        <SelectedCard listing={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

/** The card that slides up from the bottom when a pin is tapped. */
function SelectedCard({ listing, onClose }: { listing: ResultListing; onClose: () => void }) {
  return (
    <div className="fixed inset-x-3 bottom-20 z-20">
      <div className="card shadow-xl overflow-hidden relative">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-2 right-2 z-10 size-7 grid place-items-center
                     rounded-full bg-surface/90 text-ink-soft shadow-sm"
        >
          ×
        </button>
        <Link href={`/listing/${listing.id}`} className="flex gap-3 p-3">
          <div className="size-20 shrink-0 rounded-lg bg-paper border border-line overflow-hidden">
            {listing.coverPhotoKey ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl(listing.coverPhotoKey, 400)} alt=""
                   className="size-full object-cover" />
            ) : (
              <div className="size-full grid place-items-center text-ink-faint text-[10px]">
                No photo
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 pr-6">
            <h3 className="font-medium text-sm leading-snug line-clamp-2">{listing.title}</h3>
            <p className="mt-1 text-sm font-medium tabular-nums">
              {formatPrice(listing.priceCents, listing.pricePeriod)}
            </p>
            <p className="text-xs text-ink-faint">
              Sleeps {listing.maxGuests}
              {listing.roomType === "shared" && listing.flatmateCount !== null
                ? ` · shared with ${listing.flatmateCount}`
                : " · whole flat"}
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}

function toPin(l: ResultListing, isNearMiss: boolean): MapPin {
  return {
    id: l.id, lat: l.lat, lng: l.lng, title: l.title,
    priceCents: l.priceCents, pricePeriod: l.pricePeriod, isNearMiss,
  };
}

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         className="size-4" aria-hidden>
      <path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 7 9 4.5Z" strokeLinejoin="round" />
      <path d="M9 4.5v12.5M15 7v12.5" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         className="size-4" aria-hidden>
      <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" strokeLinecap="round" />
    </svg>
  );
}
