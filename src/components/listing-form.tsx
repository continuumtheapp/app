"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AvailabilityEditor, type AvailabilityValue } from "./availability-editor";
import { daysToBlocks, blocksToDays } from "@/lib/availability";
import { PhotoUploader } from "./photo-uploader";
import { fromDayNumber } from "@/lib/dates";
import type { FullListing } from "@/lib/listings";

export function ListingForm({ existing }: { existing?: FullListing }) {
  const router = useRouter();

  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [address, setAddress] = useState(existing?.address ?? "");
  const [price, setPrice] = useState(existing ? String(existing.priceCents / 100) : "");
  const [pricePeriod, setPricePeriod] = useState(existing?.pricePeriod ?? "month");
  const [roomType, setRoomType] = useState(existing?.roomType ?? "whole_flat");
  const [flatmateCount, setFlatmateCount] = useState(
    existing?.flatmateCount != null ? String(existing.flatmateCount) : "1");
  const [maxGuests, setMaxGuests] = useState(String(existing?.maxGuests ?? 2));
  const [flintaOnly, setFlintaOnly] = useState(existing?.flintaOnly ?? false);
  const [deposit, setDeposit] = useState(existing ? String(existing.depositCents / 100) : "0");
  const [minNights, setMinNights] = useState(existing?.minNights ? String(existing.minNights) : "");
  const [maxNights, setMaxNights] = useState(existing?.maxNights ? String(existing.maxNights) : "");
  const [photoKeys, setPhotoKeys] = useState<string[]>(existing?.photoKeys ?? []);

  const [availability, setAvailability] = useState<AvailabilityValue>({
    days: existing ? blocksToDays(existing.blocks) : [],
    flexible: existing?.flexibleDays ?? [],
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (availability.days.length === 0) {
      setError("Mark at least one period of availability on the calendar.");
      return;
    }

    setSaving(true);
    const response = await fetch(existing ? `/api/listings/${existing.id}` : "/api/listings", {
      method: existing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: description || undefined,
        address,
        priceCents: Math.round(Number(price) * 100),
        pricePeriod,
        roomType,
        flatmateCount: roomType === "shared" ? Number(flatmateCount) : null,
        maxGuests: Number(maxGuests),
        flintaOnly,
        depositCents: Math.round(Number(deposit) * 100),
        minNights: minNights ? Number(minNights) : null,
        maxNights: maxNights ? Number(maxNights) : null,
        blocks: daysToBlocks(availability.days),
        flexibleDays: availability.flexible.map(fromDayNumber),
        photoKeys,
      }),
    });

    const body = (await response.json()) as { error?: string; id?: number };
    if (!response.ok) {
      setError(body.error ?? "Couldn't save that.");
      setSaving(false);
      return;
    }
    router.push(`/listing/${body.id}`);
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <Section title="The place">
        <div>
          <label className="label" htmlFor="title">Title</label>
          <input id="title" required maxLength={120} className="field" value={title}
                 onChange={(e) => setTitle(e.target.value)}
                 placeholder="Sunny room in Neukölln, quiet courtyard" />
        </div>

        <div>
          <label className="label" htmlFor="description">Description</label>
          <textarea id="description" rows={6} maxLength={4000} className="field resize-y"
                    value={description} onChange={(e) => setDescription(e.target.value)}
                    placeholder="What's it like? Who lives there? Anything worth knowing." />
          <p className="mt-1 text-xs text-ink-faint">
            Write it however you like — there's no form to fill in.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="address">Address or nearest cross street</label>
          <input id="address" required maxLength={200} className="field" value={address}
                 onChange={(e) => setAddress(e.target.value)}
                 placeholder="Sonnenallee 100, Neukölln" />
          <p className="mt-1 text-xs text-ink-faint">
            Used to place a pin on the map. Berlin only.
          </p>
        </div>

        <div>
          <span className="label">Photos</span>
          <PhotoUploader keys={photoKeys} onChange={setPhotoKeys} />
        </div>
      </Section>

      <Section title="What kind of place">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="roomType">Whole flat or shared</label>
            <select id="roomType" className="field" value={roomType}
                    onChange={(e) => setRoomType(e.target.value as "whole_flat" | "shared")}>
              <option value="whole_flat">The whole flat</option>
              <option value="shared">A room in a shared flat</option>
            </select>
          </div>

          {roomType === "shared" && (
            <div>
              <label className="label" htmlFor="flatmates">People already living there</label>
              <input id="flatmates" type="number" min={0} max={20} className="field"
                     value={flatmateCount} onChange={(e) => setFlatmateCount(e.target.value)} />
            </div>
          )}

          <div>
            <label className="label" htmlFor="maxGuests">Sleeps how many</label>
            <input id="maxGuests" type="number" min={1} max={20} required className="field"
                   value={maxGuests} onChange={(e) => setMaxGuests(e.target.value)} />
          </div>
        </div>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input type="checkbox" className="mt-0.5" checked={flintaOnly}
                 onChange={(e) => setFlintaOnly(e.target.checked)} />
          <span className="text-sm">
            <span className="font-medium">FLINTA only</span>
            <span className="block text-ink-soft text-xs mt-0.5">
              Shown as a badge on your listing.
            </span>
          </span>
        </label>
      </Section>

      <Section title="Money">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="price">Price (€)</label>
            <input id="price" type="number" min={0} step="1" required className="field"
                   value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="period">Per</label>
            <select id="period" className="field" value={pricePeriod}
                    onChange={(e) => setPricePeriod(e.target.value as "night" | "week" | "month")}>
              <option value="night">Night</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </div>
          <div className="sm:col-span-3">
            <label className="label" htmlFor="deposit">Deposit (€, 0 for none)</label>
            <input id="deposit" type="number" min={0} step="1" className="field"
                   value={deposit} onChange={(e) => setDeposit(e.target.value)} />
          </div>
        </div>
      </Section>

      <Section title="When it's free"
               hint="Click the first and last day of each period you're offering.">
        <AvailabilityEditor value={availability} onChange={setAvailability} />

        <div className="grid gap-4 sm:grid-cols-2 pt-4 border-t border-line">
          <div>
            <label className="label" htmlFor="minNights">Shortest stay you'd accept</label>
            <input id="minNights" type="number" min={1} max={365} className="field"
                   placeholder="No minimum" value={minNights}
                   onChange={(e) => setMinNights(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="maxNights">Longest stay you'd accept</label>
            <input id="maxNights" type="number" min={1} max={365} className="field"
                   placeholder="No maximum" value={maxNights}
                   onChange={(e) => setMaxNights(e.target.value)} />
          </div>
          <p className="sm:col-span-2 text-xs text-ink-faint">
            Leave these blank if you're open to anything. People searching for
            slightly different dates will still see your place, with a note
            about what doesn't line up.
          </p>
        </div>
      </Section>

      {error && <p className="text-sm text-flinta">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => router.back()} className="btn btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? "Saving…" : existing ? "Save changes" : "Post it"}
        </button>
      </div>
    </form>
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
