"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toDayNumber, fromDayNumber } from "@/lib/dates";
import { boxAround } from "@/lib/geo";
import type { HousingRequest } from "@/lib/requests";
import { REQUEST_NOTE_MAX } from "@/lib/request-rules";
import { areasFor } from "@/lib/areas";
import { currencyFor, currencySymbol } from "@/lib/currency";
import type { PlaceSuggestion } from "@/lib/geo";
import { PlaceInput } from "./place-input";

type RoomType = "whole_flat" | "shared" | "either";
type Period = "night" | "week" | "month";

/** Posting a request, or editing one when `existing` is given. */
export function RequestForm({ existing }: { existing?: HousingRequest }) {
  const router = useRouter();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const e = existing;

  const [checkIn, setCheckIn] = useState(e ? fromDayNumber(e.checkIn) : "");
  const [checkOut, setCheckOut] = useState(e ? fromDayNumber(e.checkOut) : "");
  const [datesFlexible, setDatesFlexible] = useState(e?.datesFlexible ?? false);
  const [place, setPlace] = useState<PlaceSuggestion | null>(e ? {
    name: e.city, label: e.city, country: e.country, lat: e.cityLat, lng: e.cityLng,
    bbox: boxAround(e.cityLat, e.cityLng),
  } : null);
  const [areas, setAreas] = useState<string[]>(e?.areas ?? []);
  const [note, setNote] = useState(e?.note ?? "");
  const [roomType, setRoomType] = useState<RoomType>(e?.roomType ?? "either");
  const [guests, setGuests] = useState(String(e?.guests ?? 1));
  const [withChildren, setWithChildren] = useState(e?.withChildren ?? false);
  const [withPets, setWithPets] = useState(e?.withPets ?? false);
  const [budget, setBudget] = useState(e?.maxBudgetCents != null ? String(e.maxBudgetCents / 100) : "");
  const [budgetPeriod, setBudgetPeriod] = useState<Period>(e?.budgetPeriod ?? "month");
  const [needsAnmeldung, setNeedsAnmeldung] = useState(e?.needsAnmeldung ?? false);
  const [flintaOnly, setFlintaOnly] = useState(e?.flintaOnly ?? false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nights =
    checkIn && checkOut
      ? (() => {
          try { return toDayNumber(checkOut) - toDayNumber(checkIn); } catch { return 0; }
        })()
      : 0;
  const invalidDates = Boolean(checkIn && checkOut && nights < 1);

  const cityAreas = place ? areasFor(place.name, place.country) : [];
  // The budget is in the currency of the city searched.
  const currency = currencyFor(place?.country);
  const symbol = currencySymbol(currency);

  function toggleArea(area: string) {
    setAreas((a) => (a.includes(area) ? a.filter((x) => x !== area) : [...a, area]));
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    if (!place) {
      setError("Pick the city from the suggestions.");
      return;
    }
    if (!checkIn || !checkOut || invalidDates) {
      setError("Pick a move-in date and a move-out date after it.");
      return;
    }

    setSaving(true);
    const response = await fetch(e ? `/api/requests/${e.id}` : "/api/requests", {
      method: e ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        city: place.name, country: place.country, cityLat: place.lat, cityLng: place.lng,
        checkIn, checkOut, datesFlexible, areas, note: note.trim() || null, roomType,
        guests: Number(guests), withChildren, withPets,
        maxBudgetCents: budget ? Math.round(Number(budget) * 100) : null,
        budgetPeriod, needsAnmeldung: needsAnmeldung && place.country === "DE", flintaOnly,
      }),
    });

    const body = (await response.json()) as { error?: string; id?: number };
    if (!response.ok) {
      setError(body.error ?? "Couldn't save that.");
      setSaving(false);
      return;
    }
    router.push(`/requests/${body.id}`);
  }

  return (
    <form onSubmit={submit} suppressHydrationWarning className="space-y-8">
      <Section title="When">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="checkIn">Move in</label>
            <input suppressHydrationWarning id="checkIn" type="date" required min={today} className="field"
                   value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="checkOut">Move out</label>
            <input suppressHydrationWarning id="checkOut" type="date" required min={checkIn || today} className="field"
                   value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </div>
        </div>
        <p className="min-h-4 text-xs">
          {invalidDates ? (
            <span className="text-flinta">Move-out needs to be after move-in.</span>
          ) : nights > 0 ? (
            <span className="text-ink-faint">{nights} {nights === 1 ? "night" : "nights"}</span>
          ) : null}
        </p>
        <Check checked={datesFlexible} onChange={setDatesFlexible}
               label="My dates are flexible"
               hint="Hosts see this, so they know it's worth offering slightly different dates." />
      </Section>

      <Section title="Where">
        <PlaceInput id="place" place={place} required
                    onChange={(p) => { setPlace(p); setAreas([]); }} />
        {place && cityAreas.length > 0 && (
          <>
          <p className="text-xs text-ink-faint">
            Pick any neighbourhoods you&apos;d prefer, or none for anywhere in {place.name}.
          </p>
          <div className="flex flex-wrap gap-2">
          {cityAreas.map((area) => {
            const on = areas.includes(area);
            return (
              <button key={area} type="button" onClick={() => toggleArea(area)}
                      aria-pressed={on}
                      className={`rounded-full border px-3.5 py-2 text-sm transition-colors
                        ${on ? "bg-accent text-white border-accent"
                             : "bg-surface text-ink-soft border-line hover:border-line-strong"}`}>
                {area}
              </button>
            );
          })}
          </div>
          </>
        )}
      </Section>

      <Section title="What you need">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="roomType">Type of place</label>
            <select suppressHydrationWarning id="roomType" className="field" value={roomType}
                    onChange={(e) => setRoomType(e.target.value as RoomType)}>
              <option value="either">A room or a whole flat</option>
              <option value="whole_flat">Only a whole flat</option>
              <option value="shared">Only a room in a shared flat</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="guests">People</label>
            <input suppressHydrationWarning id="guests" type="number" min={1} max={20} required className="field"
                   value={guests} onChange={(e) => setGuests(e.target.value)} />
          </div>
        </div>

        <div className="space-y-3">
          <Check checked={withChildren} onChange={setWithChildren} label="Coming with children" />
          <Check checked={withPets} onChange={setWithPets} label="Coming with a pet" />
          {/* Only once a city in Germany is picked: Anmeldung is German. */}
          {place?.country === "DE" && (
            <Check checked={needsAnmeldung} onChange={setNeedsAnmeldung} label="I need Anmeldung" />
          )}
          <Check checked={flintaOnly} onChange={setFlintaOnly} label="Only FLINTA housing" />
        </div>
      </Section>

      <Section title="Budget" hint={`Optional. The most you'd pay, in ${currency}${place ? "" : " until you pick a city"}.`}>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:max-w-40">
            <input suppressHydrationWarning type="number" min={0} step="1" className="field pr-12" value={budget}
                   placeholder="Any" onChange={(e) => setBudget(e.target.value)}
                   aria-label={`Maximum budget in ${currency}`} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-faint">{symbol}</span>
          </div>
          <select suppressHydrationWarning className="field w-auto" value={budgetPeriod} aria-label="Budget period"
                  onChange={(e) => setBudgetPeriod(e.target.value as Period)}>
            <option value="night">per night</option>
            <option value="week">per week</option>
            <option value="month">per month</option>
          </select>
        </div>
      </Section>

      <Section title="About your stay"
               hint="Optional. Why you're coming, what you'll be doing, anything a host should know. Your profile already says who you are.">
        <div>
          <textarea suppressHydrationWarning id="note" className="field min-h-28" value={note} maxLength={REQUEST_NOTE_MAX}
                    aria-label="About your stay" onChange={(e) => setNote(e.target.value)}
                    placeholder="Coming for a three-month job at a studio in Kreuzberg, quiet, out most days…" />
          <p className="mt-1.5 text-xs text-ink-faint text-right tabular-nums">{note.length}/{REQUEST_NOTE_MAX}</p>
        </div>
      </Section>

      {error && <p className="text-sm text-flinta">{error}</p>}

      {/* Cancel goes somewhere fixed: "back" depended on browser history and
          sometimes went nowhere, or to a stale page. */}
      <div className="btn-row">
        <Link href={e ? "/my-listings" : "/"} className="btn btn-secondary">
          Cancel
        </Link>
        <button type="submit" disabled={saving || invalidDates} className="btn btn-primary">
          {saving ? "Saving…" : e ? "Save changes" : "Post request"}
        </button>
      </div>
    </form>
  );
}

function Check({ checked, onChange, label, hint }:
  { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer">
      <input suppressHydrationWarning type="checkbox" className="mt-0.5" checked={checked}
             onChange={(e) => onChange(e.target.checked)} />
      <span className="text-sm">
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-ink-soft text-xs mt-0.5">{hint}</span>}
      </span>
    </label>
  );
}

function Section({ title, hint, children }:
  { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 space-y-4">
      <div>
        <h2 className="font-medium">{title}</h2>
        {hint && <p className="text-xs text-ink-faint mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
  );
}
