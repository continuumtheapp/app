"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Status changes for a seeker's own request. Once its dates have passed there
 * is nothing to reopen: the way forward is a new request with new dates.
 */
export function RequestActions({ id, status, datesPassed }:
  { id: number; status: string; datesPassed: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setStatus(next: "open" | "found" | "closed") {
    setBusy(true);
    await fetch(`/api/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    router.refresh();
    setBusy(false);
  }

  if (datesPassed) {
    return (
      <Link href="/requests/new" className="btn btn-primary w-full">Post new dates</Link>
    );
  }
  if (status === "open") {
    return (
      <div className="btn-row">
        <button onClick={() => setStatus("found")} disabled={busy} className="btn btn-primary">
          I found a place
        </button>
        <button onClick={() => setStatus("closed")} disabled={busy} className="btn btn-secondary">
          Close request
        </button>
      </div>
    );
  }
  if (status === "found" || status === "closed") {
    return (
      <button onClick={() => setStatus("open")} disabled={busy} className="btn btn-secondary w-full">
        Still looking
      </button>
    );
  }
  return null;
}
