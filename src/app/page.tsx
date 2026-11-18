import { Suspense } from "react";
import Link from "next/link";
import { SearchForm } from "@/components/search-form";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:py-20">
      <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-balance">
        Short-term housing, shared within our community.
      </h1>
      <p className="mt-4 text-ink-soft leading-relaxed text-balance">
        Tell us the dates you actually need. We'll show what fits — and then
        what nearly fits.
      </p>

      <div className="mt-8">
        <Suspense fallback={<div className="card h-64 animate-pulse" />}>
          <SearchForm />
        </Suspense>
        <p className="mt-3 text-sm text-ink-soft text-center">
          Rather let hosts know what you need?{" "}
          <Link href="/requests/new" className="underline underline-offset-2">
            Post what you're looking for
          </Link>
        </p>
      </div>
    </div>
  );
}
