"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function JoinReviewActions({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(action: "approve" | "reject") {
    setBusy(true);
    await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, userId }),
    });
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="btn-row">
      <button onClick={() => { if (confirm(`Reject ${name}? They won't be able to ask again.`)) act("reject"); }}
              disabled={busy} className="btn btn-danger">
        Reject
      </button>
      <button onClick={() => act("approve")} disabled={busy} className="btn btn-primary">
        Approve
      </button>
    </div>
  );
}

/** Checked or not, for an ID check. Either way the photos are deleted. */
export function IdReviewActions({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(action: "verify-id" | "reject-id") {
    setBusy(true);
    await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, userId }),
    });
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="btn-row">
      <button onClick={() => { if (confirm(`Not confirmed for ${name}? They can send new photos.`)) act("reject-id"); }}
              disabled={busy} className="btn btn-danger">
        Can&apos;t confirm
      </button>
      <button onClick={() => act("verify-id")} disabled={busy} className="btn btn-primary">
        Same person
      </button>
    </div>
  );
}
