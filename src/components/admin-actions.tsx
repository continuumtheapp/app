"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminActions({
  reportId, listingId, hostId, hidden,
}: {
  reportId: number; listingId: number; hostId: string; hidden: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(action: string, body: Record<string, unknown> = {}) {
    setBusy(true);
    await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reportId, listingId, hostId, ...body }),
    });
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="btn-row">
      <button onClick={() => act("dismiss")} disabled={busy} className="btn btn-secondary">
        Dismiss
      </button>
      <button onClick={() => act(hidden ? "unhide" : "hide")} disabled={busy} className="btn btn-secondary">
        {hidden ? "Unhide" : "Hide"}
      </button>
      <button onClick={() => { if (confirm("Ban this host and hide all their listings?")) act("ban"); }}
              disabled={busy} className="btn btn-danger">
        Ban host
      </button>
    </div>
  );
}
