"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * A big red delete at the top of an edit page, for a place or a search.
 * It asks once more in place, since there's no undo.
 */
export function DeleteButton({ endpoint, what }: { endpoint: string; what: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const response = await fetch(endpoint, { method: "DELETE" });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Couldn't delete that.");
      setBusy(false);
      return;
    }
    router.push("/my-listings");
    router.refresh();
  }

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="btn btn-delete w-full">
        Delete {what}
      </button>
    );
  }

  return (
    <div className="card border-delete p-4">
      <p className="text-sm text-center">
        Delete this {what} for good? This can&apos;t be undone.
      </p>
      {error && <p className="mt-2 text-xs text-center text-delete">{error}</p>}
      <div className="btn-row mt-3">
        <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="btn btn-secondary">
          Keep it
        </button>
        <button type="button" onClick={remove} disabled={busy} className="btn btn-delete">
          {busy ? "Deleting…" : "Yes, delete"}
        </button>
      </div>
    </div>
  );
}
