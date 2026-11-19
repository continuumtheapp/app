"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "./avatar";

interface Candidate { id: string; name: string | null; image: string | null; telegramHandle: string | null }

/**
 * A place's buttons on My posts. "Mark as taken" is gold: the one action we
 * most want people to take, so what's on the board stays true. It asks who's
 * staying, so host and guest can review each other after the stay.
 */
export function MyListingActions({ id, status, candidates = [], lastDay = null }: {
  id: number;
  status: string;
  /** Members who asked for this place's contact. */
  candidates?: Candidate[];
  /** The place's last free day (YYYY-MM-DD), to suggest as the move-out day. */
  lastDay?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  async function setStatus(next: "taken" | "published", extra: Record<string, unknown> = {}) {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next, ...extra }),
    });
    // Say why when it's refused, e.g. already 2 places up: silence looked broken.
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Couldn't change that. Try again.");
    } else {
      setAsking(false);
    }
    router.refresh();
    setBusy(false);
  }

  return (
    <>
      <div className="btn-row">
        <Link href={`/listing/${id}/edit`} className="btn btn-secondary">Edit</Link>
        {status === "published" ? (
          <button onClick={() => setAsking(true)} disabled={busy} className="btn btn-gold">
            Mark as taken
          </button>
        ) : status === "taken" ? (
          <button onClick={() => setStatus("published")} disabled={busy} className="btn btn-primary">
            Available again
          </button>
        ) : null}
      </div>
      {error && !asking && <p className="mt-2 text-sm text-delete">{error}</p>}

      {asking && (
        <WhoIsStaying
          candidates={candidates}
          lastDay={lastDay}
          busy={busy}
          error={error}
          onCancel={() => { setAsking(false); setError(null); }}
          onConfirm={(guest, endsOn) => setStatus("taken", { guest, endsOn })}
        />
      )}
    </>
  );
}

type Choice = { kind: "member"; id: string } | { kind: "outside" } | { kind: "unsaid" };

function WhoIsStaying({ candidates, lastDay, busy, error, onCancel, onConfirm }: {
  candidates: Candidate[];
  lastDay: string | null;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (guest: Choice, endsOn: string | null) => void;
}) {
  const [choice, setChoice] = useState<Choice | null>(null);
  const [endsOn, setEndsOn] = useState(lastDay ?? "");
  const key = (c: Choice) => (c.kind === "member" ? c.id : c.kind);

  const options: { choice: Choice; label: string; note?: string; person?: Candidate }[] = [
    ...candidates.map((c) => ({
      choice: { kind: "member", id: c.id } as Choice,
      label: c.name ?? c.telegramHandle ?? "A member",
      note: c.telegramHandle ?? undefined,  // stored with its @
      person: c,
    })),
    { choice: { kind: "outside" }, label: "Someone outside SimbaCasa" },
    { choice: { kind: "unsaid" }, label: "I'd rather not say" },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-ink/45 flex items-end sm:items-center sm:justify-center" onClick={onCancel}>
      <div className="sheet w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl px-5 pt-3 pb-5 max-h-[90vh] overflow-y-auto"
           onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Who's staying?">
        <div className="sheet-handle sm:hidden" aria-hidden />
        <h2 className="text-lg font-medium">Who&apos;s staying?</h2>
        <p className="mt-1 text-sm text-ink-soft">
          So you and your guest can review each other after the stay.
          {candidates.length > 0 ? " These are the members who asked for your contact." : ""}
        </p>

        <div className="mt-4 space-y-2">
          {options.map((o) => {
            const on = choice !== null && key(choice) === key(o.choice);
            return (
              <button key={key(o.choice)} type="button" onClick={() => setChoice(o.choice)}
                      aria-pressed={on}
                      className={`w-full min-h-12 flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors
                        ${on ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-line-strong"}`}>
                {o.person && <Avatar name={o.person.name} image={o.person.image} size={32} />}
                <span className="min-w-0">
                  <span className="block text-sm font-medium truncate">{o.label}</span>
                  {o.note && <span className="block text-xs text-ink-faint">{o.note}</span>}
                </span>
              </button>
            );
          })}
        </div>

        {choice?.kind === "member" && (
          <div className="mt-4">
            <label className="label" htmlFor="ends-on">Move-out day</label>
            <input suppressHydrationWarning id="ends-on" type="date" className="field" value={endsOn}
                   onChange={(e) => setEndsOn(e.target.value)} />
            <p className="mt-1 text-xs text-ink-faint">You can both write a review from this day.</p>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-delete">{error}</p>}

        <div className="btn-row mt-5">
          <button type="button" onClick={onCancel} disabled={busy} className="btn btn-secondary">Cancel</button>
          <button type="button" disabled={busy || choice === null} className="btn btn-gold"
                  onClick={() => choice && onConfirm(choice, choice.kind === "member" && endsOn ? endsOn : null)}>
            {busy ? "Saving…" : "Mark as taken"}
          </button>
        </div>
      </div>
    </div>
  );
}
