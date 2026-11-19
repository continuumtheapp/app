import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "SimbaCasa",
  description: "Short-term housing, shared within our community.",
  appleWebApp: { title: "SimbaCasa" },
  // Stop iPhones turning dates, addresses and numbers into links: they'd be
  // wrong here ("8 Nov – 12 Nov" isn't an event to add to a calendar).
  formatDetection: { telephone: false, date: false, address: false, email: false },
};

/** The browser's top bar on phones, in the header's petrol. */
export const viewport: Viewport = {
  themeColor: "#014e4b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Chrome on iPhone adds its own attributes to <html> (and to every form
    // and field, for autofill: hence suppressHydrationWarning on each of them)
    // before React loads; extensions such as ColorZilla do the same
    // to <body>. suppressHydrationWarning only ignores attribute differences
    // on that one element, never on anything inside it.
    <html lang="en" suppressHydrationWarning>
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
