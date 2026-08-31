"use client";

import { useState } from "react";
import { SearchForm } from "./search-form";
import { fromDayNumber } from "@/lib/dates";

/**
 * Collapsed search bar for mobile.
 *
 * The full form fills an entire phone screen, so results only begin below the
 * fold. Collapsing it to a one-line summary puts listings first and keeps the
 * form one tap away — the same trade Airbnb makes.
 *
 * On desktop there is room for the whole form, so this collapses only below lg.
 */
export function SearchSummary({
  checkIn,
  checkOut,
  guests,
}: {
  checkIn: number;
  checkOut: number;
  guests: number;
}) {
  const [open, setOpen] = useState(false);
  const nights = checkOut - checkIn;

  const short = (day: number) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" })
      .format(new Date(fromDayNumber(day) + "T00:00:00Z"));

  return (
    <>
      {/* Mobile: a summary pill that opens the form in a sheet. */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full card px-4 py-3 flex items-center gap-3 text-left active:bg-paper"
        >
          <SearchIcon />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium truncate">
              {short(checkIn)} – {short(checkOut)}
            </span>
            <span className="block text-xs text-ink-faint">
              {nights} {nights === 1 ? "night" : "nights"} ·{" "}
              {guests} {guests === 1 ? "person" : "people"}
            </span>
          </span>
        </button>

        {open && (
          <div className="fixed inset-0 z-50 bg-ink/20 flex items-end sm:items-center sm:justify-center"
               onClick={() => setOpen(false)}>
            <div
              className="w-full sm:max-w-md bg-paper rounded-t-2xl sm:rounded-2xl p-4 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-medium">Change search</h2>
                <button onClick={() => setOpen(false)}
                        className="size-8 grid place-items-center rounded-full hover:bg-line/40"
                        aria-label="Close">
                  ×
                </button>
              </div>
              <SearchForm compact />
            </div>
          </div>
        )}
      </div>

      {/* Desktop: room for the full form. */}
      <div className="hidden lg:block">
        <SearchForm compact />
      </div>
    </>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         className="size-4 shrink-0 text-ink-faint" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}
