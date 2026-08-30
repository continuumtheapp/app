"use client";

import { useMemo, useState } from "react";
import { fromDayNumber } from "@/lib/dates";

/**
 * The host's availability editor.
 *
 * Click a day to start a range, click another to finish it. Click a day inside
 * an existing range to toggle it "maybe" — the host is offering it but isn't
 * sure yet. Click a marked day again to clear it, or click the range edges to
 * remove availability.
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

export function AvailabilityEditor({
  value,
  onChange,
}: {
  value: AvailabilityValue;
  onChange: (next: AvailabilityValue) => void;
}) {
  const [pendingStart, setPendingStart] = useState<number | null>(null);
  const [mode, setMode] = useState<"available" | "flexible">("available");

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

  function clickDay(day: number) {
    if (day < today) return;

    if (mode === "flexible") {
      // Only days already offered can be marked uncertain.
      if (!available.has(day)) return;
      const next = new Set(flexible);
      next.has(day) ? next.delete(day) : next.add(day);
      onChange({ ...value, flexible: [...next].sort((a, b) => a - b) });
      return;
    }

    if (pendingStart === null) {
      setPendingStart(day);
      return;
    }

    const [from, to] = pendingStart <= day ? [pendingStart, day] : [day, pendingStart];
    const range: number[] = [];
    for (let d = from; d <= to; d++) range.push(d);

    // Dragging over an already-available range clears it instead.
    const allSelected = range.every((d) => available.has(d));
    const next = new Set(available);
    for (const d of range) allSelected ? next.delete(d) : next.add(d);

    const nextDays = [...next].sort((a, b) => a - b);
    onChange({
      days: nextDays,
      // A day can't be "maybe available" if it isn't available at all.
      flexible: value.flexible.filter((d) => next.has(d)),
    });
    setPendingStart(null);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <ModeButton active={mode === "available"} onClick={() => { setMode("available"); setPendingStart(null); }}>
          Mark available
        </ModeButton>
        <ModeButton active={mode === "flexible"} onClick={() => { setMode("flexible"); setPendingStart(null); }}>
          Mark "not sure yet"
        </ModeButton>
        {value.days.length > 0 && (
          <button type="button" onClick={() => onChange({ days: [], flexible: [] })}
                  className="ml-auto text-xs text-ink-faint hover:text-ink-soft underline underline-offset-2">
            Clear all
          </button>
        )}
      </div>

      <p className="text-xs text-ink-faint mb-4">
        {mode === "available"
          ? pendingStart === null
            ? "Click the first day you're free, then the last day."
            : `Started ${fromDayNumber(pendingStart)} — now click the last day.`
          : "Click any available day you're not certain about yet."}
      </p>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
                const isPending = pendingStart === day;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={past}
                    onClick={() => clickDay(day)}
                    aria-pressed={isAvailable}
                    className={[
                      "text-xs py-1 rounded transition-colors",
                      past ? "text-ink-faint/40 cursor-not-allowed"
                      : isPending ? "bg-accent text-white font-medium ring-2 ring-accent"
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
            (value.flexible.length > 0 ? `, ${value.flexible.length} not yet certain` : "")}
      </p>
    </div>
  );
}

function ModeButton({ active, onClick, children }:
  { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
            className={`btn text-sm py-1.5 ${active ? "btn-primary" : "btn-secondary"}`}>
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
