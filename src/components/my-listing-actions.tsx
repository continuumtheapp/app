"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function MyListingActions({ id, status }: { id: number; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setStatus(next: "taken" | "published") {
    setBusy(true);
    await fetch(`/api/listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="btn-row">
      <Link href={`/listing/${id}/edit`} className="btn btn-secondary">Edit</Link>
      {status === "published" ? (
        <button onClick={() => setStatus("taken")} disabled={busy} className="btn btn-secondary">
          Mark as taken
        </button>
      ) : status === "taken" ? (
        <button onClick={() => setStatus("published")} disabled={busy} className="btn btn-primary">
          Available again
        </button>
      ) : null}
    </div>
  );
}
