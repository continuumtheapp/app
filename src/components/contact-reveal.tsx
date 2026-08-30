"use client";

import { useState } from "react";
import Link from "next/link";

interface Contact {
  method: "telegram" | "whatsapp";
  handle: string;
  url: string;
  hostName: string | null;
}

/**
 * Handles sit behind a click. It doesn't make them secret — anyone signed in
 * can press the button — but it stops casual bulk scraping and gives us a log
 * when someone works through the whole board.
 */
export function ContactReveal({
  listingId,
  signedIn,
  hasContact,
}: {
  listingId: number;
  signedIn: boolean;
  hasContact: boolean;
}) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!signedIn) {
    return (
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-ink-soft">Sign in to get in touch with the host.</p>
        <Link href={`/sign-in?next=/listing/${listingId}`} className="btn btn-primary">Sign in</Link>
      </div>
    );
  }

  if (!hasContact) {
    return (
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-ink-soft">
          Add your own Telegram or WhatsApp first, so hosts can reply to you.
        </p>
        <Link href="/profile" className="btn btn-primary">Add contact</Link>
      </div>
    );
  }

  if (contact) {
    const label = contact.method === "telegram" ? "Telegram" : "WhatsApp";
    return (
      <div>
        <p className="text-sm text-ink-soft">
          Message {contact.hostName ?? "the host"} on {label}:
        </p>
        <a href={contact.url} target="_blank" rel="noopener noreferrer"
           className="btn btn-primary mt-3">
          Open {label}
        </a>
        <p className="mt-2 text-xs text-ink-faint">{contact.handle}</p>
      </div>
    );
  }

  async function reveal() {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/listings/${listingId}/contact`, { method: "POST" });
    const body = (await response.json()) as { error?: string } & Contact;
    if (!response.ok) setError(body.error ?? "Couldn't load that just now.");
    else setContact(body);
    setLoading(false);
  }

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div>
        <p className="text-sm font-medium">Interested?</p>
        <p className="text-sm text-ink-soft">
          Arrange it directly with the host — we're not involved after this.
        </p>
        {error && <p className="mt-1.5 text-xs text-flinta">{error}</p>}
      </div>
      <button onClick={reveal} disabled={loading} className="btn btn-primary">
        {loading ? "…" : "Show contact"}
      </button>
    </div>
  );
}
