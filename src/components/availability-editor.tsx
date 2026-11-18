"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fromDayNumber } from "@/lib/dates";

/**
 * The host's availability editor.
 *
 * Pick a brush — "available" or "not sure yet" — then drag across days with
 * the mouse, or click (tap) the first day and then the last. Going over days
 * that already have that marking takes it off again.
 *
 * "Not sure yet" days are offered but uncertain (the host may be back early,
 * a flatmate may stay). Search shows them as "may be free" instead of hiding
 * the place. They count as offered, so they can be marked directly.
 *
 * On touch screens dragging would fight with scrolling, so there it's tap
 * first day, tap last day.
 *
 * It has to feel like marking a wall calendar, not configuring software.
 */
export interface AvailabilityValue {
  /** Available days, as day numbers. Converted to blocks on submit. */
  days: number[];
  /** Subset of `days` the host isn't certain about. */
  flexible: number[];
}

const MONTHS_SHOWN = 6;

type Mode = "available" | "flexible";

/** Apply one brush stroke over [from, to] (inclusive). */
export function applyRange(
  value: AvailabilityValue, from: number, to: number, mode: Mode,
): AvailabilityValue {
  const [lo, hi] = from <= to ? [from, to] : [to, from];
  const range: number[] = [];
  for (let d = lo; d <= hi; d++) range.push(d);

  const days = new Set(value.days);
  const flexible = new Set(value.flexible);

  if (mode === "available") {
    // Already all certainly available: the stroke clears them.
    const clearing = range.every((d) => days.has(d) && !flexible.has(d));
    for (const d of range) {
      if (clearing) days.delete(d);
      else days.add(d);
      flexible.delete(d);
    }
  } else {
    // Already all "not sure": the stroke makes them certain again.
    const unmarking = range.every((d) => flexible.has(d));
    for (const d of range) {
      if (unmarking) flexible.delete(d);
      else { days.add(d); flexible.add(d); }
    }
  }

  const sorted = (xs: Set<number>) => [...xs].sort((a, b) => a - b);
  return { days: sorted(days), flexible: sorted(flexible) };
}

export function AvailabilityEditor({
  value,
  onChange,
}: {
  value: AvailabilityValue;
  onChange: (next: AvailabilityValue) => void;
}) {
  // The first day of a range in progress (from a click, or a drag's start).
  const [anchor, setAnchor] = useState<number | null>(null);
  // The day under the pointer, to preview the range before it's committed.
  const [hover, setHover] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("available");
  const drag = useRef<{ start: number; moved: boolean } | null>(null);
  // A drag released on a day also fires that day's click: swallow it.
  const justDragged = useRef(false);

  const available = useMemo(() => new Set(value.days), [value.days]);
  const flexible = useMemo(() => new Set(value.flexible), [value.flexible]);

  const today = useMemo(() => {
    const now = new Date();
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86_400_000;
  }, []);

  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: MONTHS_SHOWN }, (_, i) =>
      monthGrid(now.getUTCFullYear(), now.getUTCMonth() + i),
    );
  }, []);

  // Latest values for the window listener below.
  const latest = useRef({ value, onChange, mode, hover });
  latest.current = { value, onChange, mode, hover };

  // A drag can end anywhere, even outside the calendar.
  useEffect(() => {
    function end() {
      const d = drag.current;
      if (!d) return;
      drag.current = null;
      if (!d.moved) return; // a plain click: handled as click-then-click
      justDragged.current = true;
      setTimeout(() => { justDragged.current = false; }, 0);
      const { value, onChange, mode, hover } = latest.current;
      onChange(applyRange(value, d.start, hover ?? d.start, mode));
      setAnchor(null);
    }
    window.addEventListener("pointerup", end);
    return () => window.removeEventListener("pointerup", end);
  }, []);

  function pointerDown(e: React.PointerEvent, day: number) {
    if (day < today || e.pointerType === "touch" || e.button !== 0) return;
    e.preventDefault(); // no text selection while dragging
    drag.current = { start: day, moved: false };
    setHover(day);
  }

  function pointerEnter(day: number) {
    if (day < today) return;
    setHover(day);
    const d = drag.current;
    if (d && day !== d.start && !d.moved) {
      d.moved = true;
      setAnchor(d.start);
    }
  }

  function click(day: number) {
    if (day < today) return;
    if (anchor === null) {
      setAnchor(day);
      setHover(day);
      return;
    }
    onChange(applyRange(value, anchor, day, mode));
    setAnchor(null);
  }

  const preview = anchor !== null && hover !== null
    ? [Math.min(anchor, hover), Math.max(anchor, hover)] as const
    : null;

  function changeMode(next: Mode) {
    setMode(next);
    setAnchor(null);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <ModeButton active={mode === "available"} onClick={() => changeMode("available")}>
          <span className="inline-block size-2.5 rounded-sm bg-accent-soft border border-accent mr-1.5" />
          Available
        </ModeButton>
        <ModeButton active={mode === "flexible"} onClick={() => changeMode("flexible")}>
          <span className="inline-block size-2.5 rounded-sm bg-flexible-soft border border-flexible mr-1.5" />
          Not sure yet
        </ModeButton>
        {value.days.length > 0 && (
          <button type="button" onClick={() => { onChange({ days: [], flexible: [] }); setAnchor(null); }}
                  className="btn btn-secondary text-sm py-1.5 ml-auto">
            Clear all
          </button>
        )}
      </div>

      <p className="text-xs text-ink-faint mb-4 min-h-8">
        {anchor === null
          ? mode === "available"
            ? "Drag across the days you're free, or click the first day and then the last."
            : "Same, for days you might be free but can't promise yet."
          : `From ${fromDayNumber(anchor)} — now ${drag.current ? "let go on" : "click"} the last day.`}
      </p>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 select-none"
           onPointerLeave={() => { if (!drag.current && anchor === null) setHover(null); }}>
        {months.map((m) => (
          <div key={m.label}>
            <p className="text-sm font-medium mb-2">{m.label}</p>
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <span key={i} className="text-[10px] text-ink-faint pb-1">{d}</span>
              ))}
              {m.days.map((day, i) => {
                if (day === null) return <span key={i} />;
                const past = day < today;
                const isAvailable = available.has(day);
                const isFlexible = flexible.has(day);
                const inPreview = preview !== null && day >= preview[0] && day <= preview[1];
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={past}
                    onPointerDown={(e) => pointerDown(e, day)}
                    onPointerEnter={() => pointerEnter(day)}
                    onClick={() => { if (!drag.current && !justDragged.current) click(day); }}
                    aria-pressed={isAvailable}
                    aria-label={`${fromDayNumber(day)}${isFlexible ? ", not sure yet" : isAvailable ? ", available" : ""}`}
                    className={[
                      "text-xs py-1 rounded transition-colors",
                      past ? "text-ink-faint/40 cursor-not-allowed"
                      : inPreview
                        ? mode === "flexible"
                          ? "bg-flexible text-white font-medium"
                          : "bg-accent text-white font-medium"
                      : isFlexible ? "bg-flexible-soft text-flexible font-medium hover:brightness-95"
                      : isAvailable ? "bg-accent-soft text-accent-ink font-medium hover:brightness-95"
                      : "hover:bg-paper text-ink-soft",
                    ].join(" ")}
                  >
                    {new Date(fromDayNumber(day) + "T00:00:00Z").getUTCDate()}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-ink-faint">
        {value.days.length === 0
          ? "No availability marked yet."
          : `${value.days.length} ${value.days.length === 1 ? "day" : "days"} marked` +
            (value.flexible.length > 0 ? `, ${value.flexible.length} not sure yet` : "")}
      </p>
    </div>
  );
}

function ModeButton({ active, onClick, children }:
  { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
            className={`btn text-sm py-1.5 inline-flex items-center ${active ? "btn-primary" : "btn-secondary"}`}>
      {children}
    </button>
  );
}

function monthGrid(year: number, monthIndex: number) {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const label = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC", month: "long", year: "numeric",
  }).format(first);
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const leading = (first.getUTCDay() + 6) % 7;

  const days: (number | null)[] = Array(leading).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(Date.UTC(year, monthIndex, d) / 86_400_000);
  }
  return { label, days };
}
