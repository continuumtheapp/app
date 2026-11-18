import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "SimbaCasa",
  description: "Short-term housing, shared within our community.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* Extensions such as ColorZilla add attributes to <body> before React
          loads. This only ignores attribute differences on <body> itself. */}
      <body className="min-h-screen flex flex-col" suppressHydrationWarning>
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line mt-16">
          <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-ink-faint flex flex-wrap gap-x-5 gap-y-2">
            <span>A free noticeboard for our community. Not a booking service.</span>
            <a href="/privacy" className="hover:text-ink-soft underline underline-offset-2">Privacy</a>
            <a href="/terms" className="hover:text-ink-soft underline underline-offset-2">Terms</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
