import { fromDayNumber } from "@/lib/dates";
import type { Block } from "@/lib/matching";

/**
 * The host's availability, month by month.
 *
 * Days marked "flexible" are hatched rather than solid: the host is offering
 * them but isn't certain yet. They match exactly like any other available day
 * — the distinction is for the seeker's judgement, not the algorithm's.
 */
export function AvailabilityCalendar({
  blocks,
  flexibleDays,
  months = 4,
}: {
  blocks: Block[];
  flexibleDays: number[];
  months?: number;
}) {
  if (blocks.length === 0) return null;

  const flexible = new Set(flexibleDays);
  const available = new Set<number>();
  for (const b of blocks) {
    for (let d = b.startDay; d < b.endDay; d++) available.add(d);
  }

  const firstDay = Math.min(...blocks.map((b) => b.startDay));
  const start = new Date(fromDayNumber(firstDay) + "T00:00:00Z");
  const grids = Array.from({ length: months }, (_, i) =>
    monthGrid(start.getUTCFullYear(), start.getUTCMonth() + i),
  ).filter((g) => g.days.some((d) => d !== null && available.has(d)));

  return (
    <div>
      <div className="grid gap-6 sm:grid-cols-2">
        {grids.map((g) => (
          <div key={g.label}>
            <p className="text-sm font-medium mb-2">{g.label}</p>
            <div className="grid grid-cols-7 gap-y-1 text-center">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <span key={i} className="text-[10px] text-ink-faint pb-1">{d}</span>
              ))}
              {g.days.map((day, i) =>
                day === null ? (
                  <span key={i} />
                ) : (
                  <span
                    key={i}
                    className={[
                      "text-xs py-1 rounded",
                      available.has(day)
                        ? flexible.has(day)
                          ? "bg-flexible-soft text-flexible font-medium"
                          : "bg-accent-soft text-accent-ink font-medium"
                        : "text-ink-faint",
                    ].join(" ")}
                    title={flexible.has(day) ? "The host isn't certain about this day" : undefined}
                  >
                    {new Date(fromDayNumber(day) + "T00:00:00Z").getUTCDate()}
                  </span>
                ),
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-4 text-xs text-ink-faint">
        <Key className="bg-accent-soft" label="Available" />
        {flexibleDays.length > 0 && <Key className="bg-flexible-soft" label="Maybe — ask the host" />}
      </div>
    </div>
  );
}

function Key({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-3 rounded ${className}`} aria-hidden />
      {label}
    </span>
  );
}

/** Day numbers for one month, padded so the 1st lands on the right weekday (Mon first). */
function monthGrid(year: number, monthIndex: number) {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const label = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC", month: "long", year: "numeric",
  }).format(first);

  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const leading = (first.getUTCDay() + 6) % 7; // Sunday=0 -> Monday-first
  const MS_PER_DAY = 86_400_000;

  const days: (number | null)[] = Array(leading).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(Date.UTC(year, monthIndex, d) / MS_PER_DAY);
  }
  return { label, days };
}
