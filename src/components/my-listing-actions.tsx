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
    <div className="flex flex-col items-end gap-1.5 shrink-0 text-sm">
      <Link href={`/listing/${id}/edit`} className="btn btn-secondary py-1.5 text-sm">Edit</Link>
      {status === "published" ? (
        <button onClick={() => setStatus("taken")} disabled={busy}
                className="text-xs text-ink-faint hover:text-ink-soft underline underline-offset-2">
          Mark as taken
        </button>
      ) : status === "taken" ? (
        <button onClick={() => setStatus("published")} disabled={busy}
                className="text-xs text-ink-faint hover:text-ink-soft underline underline-offset-2">
          Available again
        </button>
      ) : null}
    </div>
  );
}
