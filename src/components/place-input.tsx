"use client";

import { useEffect, useRef, useState } from "react";
import type { PlaceSuggestion } from "@/lib/geo";

/**
 * A city, picked from suggestions, anywhere in the world. Typing after
 * picking clears the pick, so the name and its location never drift apart.
 */
export function PlaceInput({
  id, place, onChange, required = false, placeholder = "Any city, e.g. Lisbon",
}: {
  id: string;
  place: PlaceSuggestion | null;
  onChange: (place: PlaceSuggestion | null) => void;
  required?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState(place?.label ?? "");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const skipNextLookup = useRef(true);

  // Wait for a pause in typing: fair use of the free geocoding service.
  useEffect(() => {
    if (skipNextLookup.current) {
      skipNextLookup.current = false;
      return;
    }
    if (text.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/places?q=${encodeURIComponent(text)}`);
        const body = (await response.json()) as { places?: PlaceSuggestion[] };
        setSuggestions(body.places ?? []);
        setOpen(true);
        setHighlighted(-1);
      } catch {
        setSuggestions([]);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [text]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function choose(p: PlaceSuggestion) {
    skipNextLookup.current = true;
    setText(p.label);
    onChange(p);
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
    } else if (e.key === "Enter" && (highlighted >= 0 || suggestions.length === 1)) {
      e.preventDefault();
      choose(suggestions[Math.max(0, highlighted)]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <input suppressHydrationWarning
        id={id}
        required={required}
        maxLength={80}
        className="field"
        value={text}
        autoComplete="off"
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          if (place) onChange(null);
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
            <li key={`${s.label},${i}`}>
              <button
                type="button"
                onClick={() => choose(s)}
                onMouseEnter={() => setHighlighted(i)}
                role="option"
                aria-selected={i === highlighted}
                className={`w-full text-left px-3 py-3 text-sm ${
                  i === highlighted ? "bg-accent-soft text-accent-ink" : "hover:bg-paper"
                }`}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A picked place in a search link, and back. */
export function placeToParams(p: PlaceSuggestion, q: URLSearchParams) {
  q.set("place", p.label);
  q.set("city", p.name);
  q.set("country", p.country);
  q.set("lat", p.lat.toFixed(5));
  q.set("lng", p.lng.toFixed(5));
  q.set("bbox", [p.bbox.south, p.bbox.west, p.bbox.north, p.bbox.east].map((n) => n.toFixed(4)).join(","));
}

export function placeFromParams(params: URLSearchParams): PlaceSuggestion | null {
  const label = params.get("place");
  const name = params.get("city");
  const country = params.get("country");
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const b = (params.get("bbox") ?? "").split(",").map(Number);
  if (!label || !name || !country || !Number.isFinite(lat) || !Number.isFinite(lng) || b.length !== 4 || b.some((n) => !Number.isFinite(n))) {
    return null;
  }
  return { label, name, country, lat, lng, bbox: { south: b[0], west: b[1], north: b[2], east: b[3] } };
}
