"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

export function ProfileForm({
  name: initialName,
  contactMethod: initialMethod,
  contactHandle: initialHandle,
  next,
}: {
  name: string | null;
  contactMethod: "telegram" | "whatsapp" | null;
  contactHandle: string | null;
  next: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName ?? "");
  const [method, setMethod] = useState<"telegram" | "whatsapp">(initialMethod ?? "telegram");
  const [handle, setHandle] = useState(initialHandle ?? "");
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
      body: JSON.stringify({ name, contactMethod: method, contactHandle: handle }),
    });

    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? "Couldn't save that.");
      setSaving(false);
      return;
    }

    setSaved(true);
    setSaving(false);
    router.refresh();
    if (next) router.push(next);
  }

  return (
    <>
      <form onSubmit={submit} className="card p-5 space-y-4">
        <div>
          <label className="label" htmlFor="name">Your name</label>
          <input id="name" className="field" value={name} maxLength={80}
                 onChange={(e) => setName(e.target.value)} placeholder="How hosts will see you" />
        </div>

        <div>
          <span className="label">How people reach you</span>
          <div className="flex gap-2">
            <select className="field w-36" value={method}
                    onChange={(e) => setMethod(e.target.value as "telegram" | "whatsapp")}>
              <option value="telegram">Telegram</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
            <input className="field flex-1" required value={handle}
                   onChange={(e) => setHandle(e.target.value)}
                   placeholder={method === "telegram" ? "@yourhandle" : "+49 170 1234567"} />
          </div>
          <p className="mt-1.5 text-xs text-ink-faint">
            Only shown to signed-in people who press "show contact" on your listing.
          </p>
        </div>

        {error && <p className="text-sm text-flinta">{error}</p>}

        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-xs text-ink-faint">Saved</span>}
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>

      <div className="mt-6 flex justify-between items-center">
        <button onClick={() => signOut().then(() => router.push("/"))}
                className="text-sm text-ink-soft hover:text-ink underline underline-offset-2">
          Sign out
        </button>
        <DeleteAccount />
      </div>
    </>
  );
}

function DeleteAccount() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)}
              className="text-xs text-ink-faint hover:text-flinta underline underline-offset-2">
        Delete my account
      </button>
    );
  }

  return (
    <span className="text-xs flex items-center gap-2">
      <span className="text-ink-soft">Delete everything, permanently?</span>
      <button onClick={() => setConfirming(false)} className="underline underline-offset-2">
        No
      </button>
      <button
        onClick={async () => {
          await fetch("/api/profile", { method: "DELETE" });
          router.push("/");
        }}
        className="text-flinta underline underline-offset-2"
      >
        Yes, delete
      </button>
    </span>
  );
}
