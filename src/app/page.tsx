import { Suspense } from "react";
import { SearchForm } from "@/components/search-form";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:py-20">
      <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-balance">
        Short-term housing in Berlin, shared within our community.
      </h1>
      <p className="mt-4 text-ink-soft leading-relaxed text-balance">
        Tell us the dates you actually need. We'll show what fits — and then
        what nearly fits, so you can ask the host whether they can shift things.
      </p>

      <div className="mt-8">
        <Suspense fallback={<div className="card h-64 animate-pulse" />}>
          <SearchForm />
        </Suspense>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-3 text-sm">
        <Point title="Search your real dates">
          No guessing at what's available. Say when you need a place and see
          what actually works.
        </Point>
        <Point title="See the near misses too">
          A place free for 12 of your 14 nights is worth knowing about. We show
          it, and tell you exactly what doesn't line up.
        </Point>
        <Point title="Talk it out yourself">
          No booking, no fees, no middleman. You get their Telegram or WhatsApp
          and take it from there.
        </Point>
      </div>
    </div>
  );
}

function Point({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-medium">{title}</h2>
      <p className="mt-1 text-ink-soft leading-relaxed">{children}</p>
    </div>
  );
}
