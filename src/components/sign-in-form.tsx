"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "@/lib/auth-client";

interface TestMember { id: string; label: string; note: string }

/**
 * Telegram is the only way to sign in. `testMembers` is non-empty only under
 * `next dev`, for trying things locally as a seed member.
 */
export function SignInForm({ telegram, testMembers, next: nextOverride }:
  { telegram: boolean; testMembers: TestMember[]; next?: string }) {
  const params = useSearchParams();
  const next = nextOverride ?? params.get("next") ?? "/";
  const [error, setError] = useState<string | null>(null);

  async function continueWithTelegram() {
    setError(null);
    const { error } = await signIn.social({ provider: "telegram", callbackURL: next });
    if (error) setError(error.message ?? "Couldn't reach Telegram. Try again in a moment.");
  }

  async function signInAsTestMember(userId: string) {
    setError(null);
    const response = await fetch("/api/auth/dev/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      setError(body.message ?? "Couldn't sign in as that member.");
      return;
    }
    // A full load, so the header and every server component see the session.
    window.location.assign(next);
  }

  return (
    <div className="card p-6">
      {telegram ? (
        <button onClick={continueWithTelegram} className="btn btn-primary w-full">
          <TelegramMark />
          Continue with Telegram
        </button>
      ) : (
        <p className="text-sm text-ink-soft">
          Telegram sign-in isn't set up yet: add TELEGRAM_CLIENT_ID and
          TELEGRAM_CLIENT_SECRET to the environment.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-flinta">{error}</p>}

      <p className="mt-4 text-xs text-ink-faint leading-relaxed">
        Use the Telegram account you're in the group with. You'll need a
        Telegram username to post or contact people.
      </p>

      {testMembers.length > 0 && (
        <div className="mt-6 pt-5 border-t border-dashed border-line">
          <p className="text-xs font-medium text-ink-soft">
            Development only: sign in as a test member
          </p>
          <div className="mt-2 space-y-2">
            {testMembers.map((m) => (
              <button key={m.id} type="button" onClick={() => signInAsTestMember(m.id)}
                      className="btn btn-secondary w-full justify-between">
                <span>{m.label}</span>
                <span className="text-xs text-ink-faint">{m.note}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TelegramMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden fill="currentColor">
      <path d="M21.94 4.3a1.2 1.2 0 0 0-1.62-1.08L2.7 10.03a.9.9 0 0 0 .06 1.7l4.47 1.4 1.7 5.4a.9.9 0 0 0 1.5.37l2.48-2.4 4.4 3.24a1.2 1.2 0 0 0 1.88-.72L21.94 4.3zM9.6 14.1l-.4 3.3-1.2-4.1 9.4-6.1-7.8 6.9z"/>
    </svg>
  );
}
