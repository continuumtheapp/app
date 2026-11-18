"use client";

import { useState } from "react";

/** A member's invite link, with Copy and (where the phone offers it) Share. */
export function InviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="card p-4">
      <p className="font-mono text-sm break-all select-all">{url}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={copy} className="btn btn-primary">{copied ? "Copied" : "Copy link"}</button>
        {canShare && (
          <button className="btn btn-secondary"
                  onClick={() => navigator.share({ title: "Join SimbaCasa", url }).catch(() => {})}>
            Share…
          </button>
        )}
        <a className="btn btn-secondary" target="_blank" rel="noopener noreferrer"
           href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent("Join me on SimbaCasa")}`}>
          Send on Telegram
        </a>
      </div>
    </div>
  );
}
