"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** A written review, no stars: what it was like, in your own words. */
export function ReviewForm({ stayId, min, max, otherName }:
  { stayId: number; min: number; max: number; otherName: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setSaving(true);
    setError(null);
    const response = await fetch(`/api/stays/${stayId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Couldn't save that.");
      setSaving(false);
      return;
    }
    router.push("/my-listings");
    router.refresh();
  }

  return (
    <form onSubmit={submit} suppressHydrationWarning className="card p-5 space-y-4">
      <div>
        <label className="label" htmlFor="review">Your review of {otherName}</label>
        <textarea suppressHydrationWarning id="review" className="field min-h-40" value={body}
                  minLength={min} maxLength={max} required
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="What was it like? Would you recommend them to other members?" />
        <p className="mt-1.5 text-xs text-ink-faint text-right tabular-nums">{body.trim().length}/{max}</p>
      </div>
      <p className="text-xs text-ink-faint">
        It appears on {otherName}&apos;s profile with your name. You can&apos;t change it afterwards.
      </p>
      {error && <p className="text-sm text-delete">{error}</p>}
      <button type="submit" disabled={saving || body.trim().length < min} className="btn btn-gold w-full">
        {saving ? "Saving…" : "Publish review"}
      </button>
    </form>
  );
}
