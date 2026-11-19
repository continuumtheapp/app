"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AvailabilityEditor, type AvailabilityValue } from "./availability-editor";
import { daysToBlocks, blocksToDays } from "@/lib/availability";
import { PhotoUploader } from "./photo-uploader";
import { AddressInput } from "./address-input";
import { hasAnmeldung } from "@/lib/areas";
import { currencyFor, currencySymbol } from "@/lib/currency";
import { fromDayNumber, toDayNumber } from "@/lib/dates";
import type { ListingDraft } from "@/lib/listing-draft";
import type { FullListing } from "@/lib/listings";
import { FAIR_RENT_PLEDGE } from "@/lib/listing-rules";

export function ListingForm({ existing, aiEnabled = false }: { existing?: FullListing; aiEnabled?: boolean }) {
  const router = useRouter();

  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [address, setAddress] = useState(existing?.address ?? "");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    existing ? { lat: existing.lat, lng: existing.lng } : null,
  );
  const euros = (cents: number | null) => (cents === null ? "" : String(cents / 100));
  const [priceNight, setPriceNight] = useState(euros(existing?.priceNightCents ?? null));
  const [priceWeek, setPriceWeek] = useState(euros(existing?.priceWeekCents ?? null));
  const [priceMonth, setPriceMonth] = useState(euros(existing?.priceMonthCents ?? null));
  const [roomType, setRoomType] = useState(existing?.roomType ?? "whole_flat");
  const [flatmateCount, setFlatmateCount] = useState(
    existing?.flatmateCount != null ? String(existing.flatmateCount) : "1");
  const [maxGuests, setMaxGuests] = useState(String(existing?.maxGuests ?? 2));
  const [flintaOnly, setFlintaOnly] = useState(existing?.flintaOnly ?? false);
  const [anmeldung, setAnmeldung] = useState(existing?.anmeldung ?? false);
  // Null until an address is picked: Anmeldung is only offered in Germany.
  const [country, setCountry] = useState<string | null>(existing?.country ?? null);
  // Prices are in the currency of the place's country; euros until one is picked.
  const currency = currencyFor(country);
  const symbol = currencySymbol(currency);
  const currencyName = symbol === currency ? currency : `${currency} (${symbol})`;
  const [petsAllowed, setPetsAllowed] = useState(existing?.petsAllowed ?? false);
  const [deposit, setDeposit] = useState(existing ? String(existing.depositCents / 100) : "0");
  const [minNights, setMinNights] = useState(existing?.minNights ? String(existing.minNights) : "");
  const [maxNights, setMaxNights] = useState(existing?.maxNights ? String(existing.maxNights) : "");
  const [photoKeys, setPhotoKeys] = useState<string[]>(existing?.photoKeys ?? []);
  const [pledged, setPledged] = useState(existing?.fairRentPledged ?? false);

  const [availability, setAvailability] = useState<AvailabilityValue>({
    days: existing ? blocksToDays(existing.blocks) : [],
    flexible: existing?.flexibleDays ?? [],
  });

  /** Fill the form from a draft Create with AI made of an old post. */
  function applyDraft(d: ListingDraft) {
    const eur = (n: number | null) => (n === null ? "" : String(Math.round(n)));
    if (d.title) setTitle(d.title.slice(0, 120));
    if (d.description) setDescription(d.description.slice(0, 4000));
    if (d.address) { setAddress(d.address); setCoords(null); }
    setPriceNight(eur(d.priceNightEuros));
    setPriceWeek(eur(d.priceWeekEuros));
    setPriceMonth(eur(d.priceMonthEuros));
    if (d.depositEuros !== null) setDeposit(eur(d.depositEuros));
    if (d.roomType) setRoomType(d.roomType);
    if (d.flatmateCount !== null) setFlatmateCount(String(d.flatmateCount));
    if (d.maxGuests !== null) setMaxGuests(String(d.maxGuests));
    setFlintaOnly(d.flintaOnly);
    setAnmeldung(d.anmeldung);
    setPetsAllowed(d.petsAllowed);
    setMinNights(d.minNights ? String(d.minNights) : "");
    setMaxNights(d.maxNights ? String(d.maxNights) : "");
    if (d.periods.length > 0) {
      setAvailability({
        days: blocksToDays(d.periods.map((p) => ({ startDay: toDayNumber(p.start), endDay: toDayNumber(p.end) }))),
        flexible: [],
      });
    }
  }

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (availability.days.length === 0) {
      setError("Mark at least one period of availability on the calendar.");
      return;
    }
    if (!priceNight && !priceWeek && !priceMonth) {
      setError("Give a price for at least one period.");
      return;
    }
    if (!coords) {
      setError("Pick an address from the suggestions so the map pin is right.");
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
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        priceNightCents: priceNight ? Math.round(Number(priceNight) * 100) : null,
        priceWeekCents: priceWeek ? Math.round(Number(priceWeek) * 100) : null,
        priceMonthCents: priceMonth ? Math.round(Number(priceMonth) * 100) : null,
        roomType,
        flatmateCount: roomType === "shared" ? Number(flatmateCount) : null,
        maxGuests: Number(maxGuests),
        flintaOnly,
        anmeldung: anmeldung && hasAnmeldung(country),
        petsAllowed,
        depositCents: Math.round(Number(deposit) * 100),
        minNights: minNights ? Number(minNights) : null,
        maxNights: maxNights ? Number(maxNights) : null,
        blocks: daysToBlocks(availability.days),
        flexibleDays: availability.flexible.map(fromDayNumber),
        photoKeys,
        fairRentPledge: pledged,
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
    <form onSubmit={submit} suppressHydrationWarning className="space-y-8">
      {aiEnabled && !existing && <CreateWithAi onDraft={applyDraft} />}
      <Section title="The place">
        <div>
          <label className="label" htmlFor="title">Title</label>
          <input suppressHydrationWarning id="title" required maxLength={120} className="field" value={title}
                 onChange={(e) => setTitle(e.target.value)}
                 placeholder="Sunny room in Neukölln, quiet courtyard" />
        </div>

        <div>
          <label className="label" htmlFor="description">Description</label>
          <textarea suppressHydrationWarning id="description" rows={6} maxLength={4000} className="field resize-y"
                    value={description} onChange={(e) => setDescription(e.target.value)}
                    placeholder="What's it like? Who lives there? Anything worth knowing." />
          <p className="mt-1 text-xs text-ink-faint">
            Write it however you like — there's no form to fill in.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="address">Address or nearest cross street</label>
          <AddressInput value={address} onChange={setAddress}
                        coords={coords} onCoordsChange={setCoords} onCountryChange={setCountry} />
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
            <select suppressHydrationWarning id="roomType" className="field" value={roomType}
                    onChange={(e) => setRoomType(e.target.value as "whole_flat" | "shared")}>
              <option value="whole_flat">The whole flat</option>
              <option value="shared">A room in a shared flat</option>
            </select>
          </div>

          {roomType === "shared" && (
            <div>
              <label className="label" htmlFor="flatmates">People already living there</label>
              <input suppressHydrationWarning id="flatmates" type="number" min={0} max={20} className="field"
                     value={flatmateCount} onChange={(e) => setFlatmateCount(e.target.value)} />
            </div>
          )}

          <div>
            <label className="label" htmlFor="maxGuests">Sleeps how many</label>
            <input suppressHydrationWarning id="maxGuests" type="number" min={1} max={20} required className="field"
                   value={maxGuests} onChange={(e) => setMaxGuests(e.target.value)} />
          </div>
        </div>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input suppressHydrationWarning type="checkbox" className="mt-0.5" checked={flintaOnly}
                 onChange={(e) => setFlintaOnly(e.target.checked)} />
          <span className="text-sm">
            <span className="font-medium">FLINTA only</span>
            <span className="block text-ink-soft text-xs mt-0.5">
              Shown as a badge on your listing.
            </span>
          </span>
        </label>

        {hasAnmeldung(country) && (
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input suppressHydrationWarning type="checkbox" className="mt-0.5" checked={anmeldung}
                   onChange={(e) => setAnmeldung(e.target.checked)} />
            <span className="text-sm">
              <span className="font-medium">Anmeldung possible</span>
              <span className="block text-ink-soft text-xs mt-0.5">
                The person staying can register at this address.
              </span>
            </span>
          </label>
        )}

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input suppressHydrationWarning type="checkbox" className="mt-0.5" checked={petsAllowed}
                 onChange={(e) => setPetsAllowed(e.target.checked)} />
          <span className="text-sm font-medium">Pets allowed</span>
        </label>
      </Section>

      <Section title="Money"
               hint={`Fill in whichever rates you offer, in ${currencyName}: the currency of the address. People searching a long stay will see your monthly rate, short stays the nightly one.`}>
        <div className="space-y-2">
          <RateField label="Per night" symbol={symbol} value={priceNight} onChange={setPriceNight} />
          <RateField label="Per week" symbol={symbol} value={priceWeek} onChange={setPriceWeek} />
          <RateField label="Per month" symbol={symbol} value={priceMonth} onChange={setPriceMonth} />
        </div>

        <div className="pt-2">
          <label className="label" htmlFor="deposit">Deposit ({symbol}, 0 for none)</label>
          <input suppressHydrationWarning id="deposit" type="number" min={0} step="1" className="field sm:max-w-48"
                 value={deposit} onChange={(e) => setDeposit(e.target.value)} />
        </div>
      </Section>

      <Section title="When it's free"
               hint="Mark every period you're offering. You can change it later.">
        <AvailabilityEditor value={availability} onChange={setAvailability} />

        <div className="grid gap-4 sm:grid-cols-2 pt-4 border-t border-line">
          <div>
            <label className="label" htmlFor="minNights">Shortest stay you'd accept</label>
            <input suppressHydrationWarning id="minNights" type="number" min={1} max={365} className="field"
                   placeholder="No minimum" value={minNights}
                   onChange={(e) => setMinNights(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="maxNights">Longest stay you'd accept</label>
            <input suppressHydrationWarning id="maxNights" type="number" min={1} max={365} className="field"
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

      <section className="card p-5">
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input suppressHydrationWarning type="checkbox" className="mt-0.5" required checked={pledged}
                 onChange={(e) => setPledged(e.target.checked)} />
          <span className="text-sm">
            <span className="font-medium">Fair Rent Pledge</span>
            <span className="block text-ink-soft mt-0.5">{FAIR_RENT_PLEDGE}</span>
          </span>
        </label>
      </section>

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

/** One optional rate. Blank means the host doesn't offer that period. */
function RateField({ label, symbol, value, onChange }:
  { label: string; symbol: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-sm text-ink-soft">{label}</span>
      <div className="relative flex-1 sm:max-w-40">
        <input suppressHydrationWarning type="number" min={0} step="1" className="field pr-12" value={value}
               placeholder="—" onChange={(e) => onChange(e.target.value)} />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-faint">{symbol}</span>
      </div>
    </div>
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

/**
 * Paste an old Telegram post and let Claude fill in the form. Everything stays
 * editable; the address still has to be picked from the suggestions.
 */
function CreateWithAi({ onDraft }: { onDraft: (draft: ListingDraft) => void }) {
  const [open, setOpen] = useState(false);
  const [post, setPost] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/listings/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post }),
    });
    const body = (await response.json().catch(() => ({}))) as { draft?: ListingDraft; error?: string };
    setBusy(false);
    if (!response.ok || !body.draft) {
      setError(body.error ?? "Couldn't read that post.");
      return;
    }
    onDraft(body.draft);
    setDone(true);
    setOpen(false);
  }

  if (!open) {
    return (
      <section className="card p-5 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="font-medium">{done ? "Filled in from your post" : "Already posted it on Telegram?"}</p>
          <p className="text-sm text-ink-soft mt-0.5">
            {done
              ? "Check every field below, and pick the address from the suggestions."
              : "Paste the post and we'll fill in the form for you."}
          </p>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="btn btn-secondary">
          {done ? "Try another post" : "Create with AI"}
        </button>
      </section>
    );
  }

  return (
    <section className="card p-5 space-y-3">
      <label className="label" htmlFor="ai-post">Your Telegram post</label>
      <textarea suppressHydrationWarning id="ai-post" rows={8} maxLength={6000} className="field resize-y" value={post}
                onChange={(e) => setPost(e.target.value)}
                placeholder="Paste the whole post, with the dates and the price." />
      <p className="text-xs text-ink-faint">
        It's read by Claude, an AI by Anthropic, only to fill in this form. Nothing is posted until you press Post it.
      </p>
      {error && <p className="text-sm text-flinta">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">Cancel</button>
        <button type="button" onClick={run} disabled={busy || post.trim().length < 20} className="btn btn-primary">
          {busy ? "Reading…" : "Fill in the form"}
        </button>
      </div>
    </section>
  );
}
