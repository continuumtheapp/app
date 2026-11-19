"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * A seeker's own request: Edit (where it can also be deleted) and its status.
 * Once its dates have passed there is nothing to reopen: the way forward is a
 * new request with new dates.
 */
export function RequestActions({ id, status, datesPassed }:
  { id: number; status: string; datesPassed: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setStatus(next: "open" | "found") {
    setBusy(true);
    await fetch(`/api/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    router.refresh();
    setBusy(false);
  }

  // Like a place's card: Edit on the left (deleting is inside it), the one
  // action that matters on the right, in gold.
  const editLink = <Link href={`/requests/${id}/edit`} className="btn btn-secondary">Edit</Link>;

  if (datesPassed) {
    return (
      <div className="btn-row">
        {editLink}
        <Link href="/requests/new" className="btn btn-primary">Post new dates</Link>
      </div>
    );
  }
  if (status === "open") {
    return (
      <div className="btn-row">
        {editLink}
        <button onClick={() => setStatus("found")} disabled={busy} className="btn btn-gold">
          I found a place
        </button>
      </div>
    );
  }
  return (
    <div className="btn-row">
      {editLink}
      <button onClick={() => setStatus("open")} disabled={busy} className="btn btn-secondary">
        Still looking
      </button>
    </div>
  );
}
