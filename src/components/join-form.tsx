"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AvatarPicker } from "./avatar-picker";

/**
 * Asking to join, once signed in with Telegram: just their profile. Who
 * invited them comes from the link, so there's nothing to ask about that.
 */
export function JoinForm({
  code, defaultName, defaultBio, defaultImage,
}: {
  code: string | null;
  defaultName: string | null;
  defaultBio: string | null;
  defaultImage: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(defaultName ?? "");
  const [bio, setBio] = useState(defaultBio ?? "");
  // undefined: keep the photo from Telegram; null: removed; string: uploaded.
  const [avatarKey, setAvatarKey] = useState<string | null | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const response = await fetch("/api/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, name, bio, ...(avatarKey !== undefined ? { avatarKey } : {}) }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Couldn't send that.");
      setSending(false);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={submit} suppressHydrationWarning className="card p-5 space-y-5">
      <div>
        <span className="label">Profile photo</span>
        <AvatarPicker name={name || defaultName} initialImage={defaultImage}
                      onChange={setAvatarKey} onError={setError} onUploading={setUploading} />
      </div>
      <div>
        <label className="label" htmlFor="join-name">Your name</label>
        <input suppressHydrationWarning id="join-name" className="field" value={name} maxLength={80} required
               onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="join-bio">About you</label>
        <textarea suppressHydrationWarning id="join-bio" className="field min-h-28" value={bio} maxLength={600} required
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="What you do, where you're based, what you're like to live with…" />
        <p className="mt-1.5 text-xs text-ink-faint text-right tabular-nums">{bio.length}/600</p>
      </div>
      {error && <p className="text-sm text-flinta">{error}</p>}
      <div className="flex justify-end">
        <button type="submit" disabled={sending || uploading} className="btn btn-primary">
          {sending ? "Sending…" : "Ask to join"}
        </button>
      </div>
    </form>
  );
}
