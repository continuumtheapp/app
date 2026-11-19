"use client";

import { useRef, useState } from "react";

/**
 * A listing's photos one at a time, swiped sideways on a phone or with the
 * arrows on a computer, like Airbnb. Stacking eight photos pushed the dates
 * and the contact button far down the page.
 *
 * It's the browser's own horizontal scrolling with snap points, so the swipe
 * feels native on every phone and needs no gesture code.
 */
export function PhotoCarousel({ urls }: { urls: string[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const count = urls.length;

  function show(i: number) {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: Math.max(0, Math.min(count - 1, i)) * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-paper">
      <div
        ref={track}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
        aria-label="Photos"
      >
        {urls.map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={url}
            src={url}
            alt={`Photo ${i + 1} of ${count}`}
            loading={i === 0 ? "eager" : "lazy"}
            draggable={false}
            className="w-full shrink-0 snap-center aspect-[3/2] sm:aspect-[16/9] object-cover"
          />
        ))}
      </div>

      {count > 1 && (
        <>
          <span className="absolute right-3 top-3 rounded-full bg-ink/60 px-2.5 py-1 text-xs font-medium text-white tabular-nums">
            {index + 1} / {count}
          </span>

          {count <= 12 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
              {urls.map((url, i) => (
                <span key={url}
                      className={`size-1.5 rounded-full transition-colors ${i === index ? "bg-white" : "bg-white/50"}`} />
              ))}
            </div>
          )}

          {/* Arrows for mouse users; on phones you swipe. */}
          <ArrowButton side="left" hidden={index === 0} onClick={() => show(index - 1)} />
          <ArrowButton side="right" hidden={index === count - 1} onClick={() => show(index + 1)} />
        </>
      )}
    </div>
  );
}

function ArrowButton({ side, hidden, onClick }:
  { side: "left" | "right"; hidden: boolean; onClick: () => void }) {
  if (hidden) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous photo" : "Next photo"}
      className={`absolute top-1/2 -translate-y-1/2 ${side === "left" ? "left-3" : "right-3"}
                  hidden sm:flex size-9 items-center justify-center rounded-full bg-white/90
                  text-ink shadow hover:bg-white`}
    >
      <svg viewBox="0 0 20 20" className="size-4" aria-hidden fill="none" stroke="currentColor" strokeWidth={2}>
        <path d={side === "left" ? "M12.5 4.5 7 10l5.5 5.5" : "M7.5 4.5 13 10l-5.5 5.5"}
              strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
