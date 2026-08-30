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
    <div className="flex flex-col items-end gap-1.5 shrink-0 text-xs">
      <button onClick={() => act("dismiss")} disabled={busy}
              className="btn btn-secondary py-1 text-xs">
        Dismiss
      </button>
      <button onClick={() => act(hidden ? "unhide" : "hide")} disabled={busy}
              className="text-ink-faint hover:text-ink-soft underline underline-offset-2">
        {hidden ? "Unhide listing" : "Hide listing"}
      </button>
      <button onClick={() => { if (confirm("Ban this host and hide all their listings?")) act("ban"); }}
              disabled={busy}
              className="text-ink-faint hover:text-flinta underline underline-offset-2">
        Ban host
      </button>
    </div>
  );
}
