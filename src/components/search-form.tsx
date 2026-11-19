"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useMemo } from "react";
import { fromDayNumber, toDayNumber } from "@/lib/dates";
import { hasAnmeldung } from "@/lib/areas";
import { currencyFor, currencySymbol } from "@/lib/currency";
import type { PlaceSuggestion } from "@/lib/geo";
import { PlaceInput, placeFromParams, placeToParams } from "./place-input";

/**
 * The seeker's own dates, exactly. No flexibility controls here on purpose:
 * people know when they need a place. Flexibility is the host's to offer, and
 * near-miss results below the exact ones are where it surfaces.
 */
export function SearchForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [place, setPlace] = useState<PlaceSuggestion | null>(() => placeFromParams(new URLSearchParams(params.toString())));
  const [checkIn, setCheckIn] = useState(params.get("checkIn") ?? "");
  const [checkOut, setCheckOut] = useState(params.get("checkOut") ?? "");
  const [guests, setGuests] = useState(params.get("guests") ?? "1");
  const [maxPrice, setMaxPrice] = useState(params.get("maxPrice") ?? "");
  const [roomType, setRoomType] = useState(params.get("roomType") ?? "");
  const [flintaOnly, setFlintaOnly] = useState(params.get("flintaOnly") === "1");
  const [anmeldung, setAnmeldung] = useState(params.get("anmeldung") === "1");
  const [pets, setPets] = useState(params.get("pets") === "1");
  const [showFilters, setShowFilters] = useState(!compact);

  const nights =
    checkIn && checkOut
      ? (() => {
          try { return toDayNumber(checkOut) - toDayNumber(checkIn); } catch { return 0; }
        })()
      : 0;

  const invalid = Boolean(checkIn && checkOut && nights < 1);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!checkIn || !checkOut || invalid) return;

    const q = new URLSearchParams();
    if (place) placeToParams(place, q);
    q.set("checkIn", checkIn);
    q.set("checkOut", checkOut);
    q.set("guests", guests);
    // Prices are in local currencies, so a budget needs a city to be in one.
    if (maxPrice && place) q.set("maxPrice", maxPrice);
    if (roomType) q.set("roomType", roomType);
    if (flintaOnly) q.set("flintaOnly", "1");
    if (anmeldung && hasAnmeldung(place?.country)) q.set("anmeldung", "1");
    if (pets) q.set("pets", "1");
    router.push(`/search?${q}`);
  }

  return (
    <form onSubmit={submit} suppressHydrationWarning className="card p-4 sm:p-5">
      <div className="mb-3">
        <label className="label" htmlFor="place">Where</label>
        <PlaceInput id="place" place={place} onChange={setPlace} placeholder="Any city — leave empty for everywhere" />
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <label className="label" htmlFor="checkIn">Check in</label>
          <input suppressHydrationWarning id="checkIn" type="date" className="field" required min={today}
                 value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="checkOut">Check out</label>
          <input suppressHydrationWarning id="checkOut" type="date" className="field" required min={checkIn || today}
                 value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
        </div>
        <div className="sm:w-24">
          <label className="label" htmlFor="guests">People</label>
          <input suppressHydrationWarning id="guests" type="number" min={1} max={20} className="field"
                 value={guests} onChange={(e) => setGuests(e.target.value)} />
        </div>
      </div>

      <div className="mt-2 min-h-5 text-xs">
        {invalid ? (
          <span className="text-flinta">Check-out needs to be after check-in.</span>
        ) : nights > 0 ? (
          <span className="text-ink-faint">
            {nights} {nights === 1 ? "night" : "nights"}
          </span>
        ) : null}
      </div>

      {showFilters ? (
        <div className="mt-3 pt-4 border-t border-line grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="maxPrice">
              Max price per night{place ? ` (${currencySymbol(currencyFor(place.country))})` : ""}
            </label>
            <input suppressHydrationWarning id="maxPrice" type="number" min={0} className="field" disabled={!place}
                   placeholder={place ? "Any" : "Pick a city first"}
                   value={place ? maxPrice : ""} onChange={(e) => setMaxPrice(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="roomType">Type of place</label>
            <select suppressHydrationWarning id="roomType" className="field" value={roomType}
                    onChange={(e) => setRoomType(e.target.value)}>
              <option value="">Any</option>
              <option value="whole_flat">Whole flat</option>
              <option value="shared">Shared flat</option>
            </select>
          </div>
          <div className="sm:col-span-2 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input suppressHydrationWarning type="checkbox" checked={flintaOnly}
                     onChange={(e) => setFlintaOnly(e.target.checked)} />
              <span className="text-ink-soft">Only FLINTA housing</span>
            </label>
            {hasAnmeldung(place?.country) && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input suppressHydrationWarning type="checkbox" checked={anmeldung}
                       onChange={(e) => setAnmeldung(e.target.checked)} />
                <span className="text-ink-soft">Anmeldung possible</span>
              </label>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input suppressHydrationWarning type="checkbox" checked={pets}
                     onChange={(e) => setPets(e.target.checked)} />
              <span className="text-ink-soft">Pets allowed</span>
            </label>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setShowFilters(true)}
                className="btn btn-secondary w-full mt-1">
          More filters
        </button>
      )}

      <button type="submit" className="btn btn-primary w-full mt-4" disabled={invalid}>
        Search
      </button>
    </form>
  );
}
