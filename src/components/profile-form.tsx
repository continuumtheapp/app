"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { AvatarPicker } from "./avatar-picker";

export function ProfileForm({
  name: initialName,
  bio: initialBio,
  image: initialImage,
  telegramHandle,
  next,
}: {
  name: string | null;
  bio: string | null;
  image: string | null;
  telegramHandle: string | null;
  next: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName ?? "");
  const [bio, setBio] = useState(initialBio ?? "");
  // undefined: photo unchanged; null: removed; string: newly uploaded key.
  const [avatarKey, setAvatarKey] = useState<string | null | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const response = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, bio, ...(avatarKey !== undefined ? { avatarKey } : {}) }),
    });

    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? "Couldn't save that.");
      setSaving(false);
      return;
    }

    setSaved(true);
    setSaving(false);
    setAvatarKey(undefined);
    router.refresh();
    if (next) router.push(next);
  }

  return (
    <>
      <form onSubmit={submit} suppressHydrationWarning className="card p-5 space-y-5">
        <div>
          <span className="label">Profile photo</span>
          <AvatarPicker name={name || initialName} initialImage={initialImage}
                        onChange={(key) => { setAvatarKey(key); setSaved(false); }}
                        onError={setError} onUploading={setUploading} />
        </div>

        <div>
          <label className="label" htmlFor="name">Your name</label>
          <input suppressHydrationWarning id="name" className="field" value={name} maxLength={80}
                 onChange={(e) => { setName(e.target.value); setSaved(false); }}
                 placeholder="How other members will see you" />
          <p className="mt-1.5 text-xs text-ink-faint">
            Taken from Telegram when you first sign in. You can use a different one here.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="bio">About you</label>
          <textarea suppressHydrationWarning id="bio" className="field min-h-28" value={bio} maxLength={600}
                    onChange={(e) => { setBio(e.target.value); setSaved(false); }}
                    placeholder="What you do, where you're based, what you're like to live with…" />
          <p className="mt-1.5 text-xs text-ink-faint text-right tabular-nums">{bio.length}/600</p>
        </div>

        <div>
          <span className="label">Telegram</span>
          <p className={`text-sm ${telegramHandle ? "" : "text-ink-faint"}`}>
            {telegramHandle ?? "No username yet"}
          </p>
          <p className="mt-1.5 text-xs text-ink-faint">
            This is how members reach you. It comes from Telegram: change it
            there, then sign in again. It's only shown to signed-in members who
            press "show contact".
          </p>
        </div>

        {error && <p className="text-sm text-flinta">{error}</p>}

        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-xs text-ink-faint">Saved</span>}
          <button type="submit" disabled={saving || uploading} className="btn btn-primary">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>

      <div className="mt-6">
        <AccountActions onSignOut={() => signOut().then(() => router.push("/"))} />
      </div>
    </>
  );
}

/** Sign out and delete side by side; deleting asks once more in place. */
function AccountActions({ onSignOut }: { onSignOut: () => void }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <div className="btn-row">
        <button onClick={onSignOut} className="btn btn-secondary">Sign out</button>
        <button onClick={() => setConfirming(true)} className="btn btn-danger">Delete account</button>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <p className="text-sm text-ink-soft text-center">Delete everything, permanently?</p>
      <div className="btn-row mt-3">
        <button onClick={() => setConfirming(false)} className="btn btn-secondary">
          No
        </button>
        <button
          onClick={async () => {
            await fetch("/api/profile", { method: "DELETE" });
            router.push("/");
          }}
          className="btn btn-danger"
        >
          Yes, delete
        </button>
      </div>
    </div>
  );
}
