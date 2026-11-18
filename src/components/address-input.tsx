"use client";

import { useEffect, useRef, useState } from "react";
import type { AddressSuggestion } from "@/lib/geo";

/**
 * Address field with suggestions, anywhere in the world.
 *
 * Picking a suggestion captures its coordinates, so the pin is exactly where
 * the host chose rather than wherever a free-text lookup happened to land.
 * Typing after choosing clears the selection — the address and its coordinates
 * must never drift apart.
 */
export function AddressInput({
  value,
  onChange,
  coords,
  onCoordsChange,
  onCountryChange,
}: {
  value: string;
  onChange: (value: string) => void;
  coords: { lat: number; lng: number } | null;
  onCoordsChange: (coords: { lat: number; lng: number } | null) => void;
  /** The picked address's country (ISO code), e.g. to offer German-only options. */
  onCountryChange?: (country: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  // Set when we fill the field ourselves, so doing so doesn't trigger a lookup.
  const skipNextLookup = useRef(false);

  // Wait for a pause in typing: fair use of the free geocoding service.
  useEffect(() => {
    if (skipNextLookup.current) {
      skipNextLookup.current = false;
      return;
    }
    if (value.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(value)}`);
        const body = (await response.json()) as { suggestions?: AddressSuggestion[] };
        setSuggestions(body.suggestions ?? []);
        setOpen(true);
        setHighlighted(-1);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [value]);

  // Close when clicking elsewhere.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function choose(s: AddressSuggestion) {
    skipNextLookup.current = true;
    onChange(s.label);
    onCoordsChange({ lat: s.lat, lng: s.lng });
    onCountryChange?.(s.country);
    setOpen(false);
    setSuggestions([]);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" && highlighted >= 0) {
      e.preventDefault();
      choose(suggestions[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        id="address"
        required
        maxLength={200}
        className="field"
        value={value}
        autoComplete="off"
        placeholder="Start typing the street and city, e.g. Sonnenallee 100 Berlin"
        onChange={(e) => {
          onChange(e.target.value);
          // The stored coordinates belong to the old text; drop them.
          if (coords) onCoordsChange(null);
        }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        aria-autocomplete="list"
        aria-expanded={open}
      />

      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full card overflow-hidden shadow-lg max-h-64 overflow-y-auto"
            role="listbox">
          {suggestions.map((s, i) => (
            <li key={`${s.lat},${s.lng},${i}`}>
              <button
                type="button"
                onClick={() => choose(s)}
                onMouseEnter={() => setHighlighted(i)}
                role="option"
                aria-selected={i === highlighted}
                className={`w-full text-left px-3 py-2 text-sm ${
                  i === highlighted ? "bg-accent-soft text-accent-ink" : "hover:bg-paper"
                }`}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-1 text-xs text-ink-faint">
        {loading
          ? "Looking up addresses…"
          : coords
            ? "Address confirmed — this is where the pin will sit."
            : "Pick a suggestion so the map pin lands in the right place."}
      </p>
    </div>
  );
}
