"use client";

import { useState } from "react";

export function ReportButton({ listingId }: { listingId: number }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  if (state === "sent") {
    return <p className="text-xs text-ink-faint">Thanks — we'll take a look.</p>;
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
              className="text-xs text-ink-faint hover:text-ink-soft underline underline-offset-2">
        Report this listing
      </button>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    const response = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, reason }),
    });
    if (response.ok) setState("sent");
    else {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? "Couldn't send that.");
      setState("idle");
    }
  }

  return (
    <form onSubmit={submit} className="card p-4 text-left max-w-md ml-auto">
      <label className="label" htmlFor="reason">What's wrong with this listing?</label>
      <textarea id="reason" required minLength={10} maxLength={1000} rows={3}
                className="field resize-y" value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="A scam, a duplicate, something offensive…" />
      {error && <p className="mt-1.5 text-xs text-flinta">{error}</p>}
      <div className="mt-3 flex gap-2 justify-end">
        <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={state === "sending"} className="btn btn-primary">
          Send report
        </button>
      </div>
    </form>
  );
}
