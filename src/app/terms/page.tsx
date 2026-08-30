export const metadata = { title: "Terms · Continuum" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-prose px-4 py-12">
      <h1 className="text-2xl font-medium tracking-tight">Terms</h1>
      <p className="mt-4 text-ink-soft leading-relaxed">
        Short version: this is a noticeboard, not an agency. We introduce
        people and then get out of the way.
      </p>

      <Section title="What this site does">
        <p>
          It lists places and helps you find them. That's all. Every
          conversation, agreement, payment and key handover happens directly
          between you and the other person, off this site.
        </p>
        <p>
          We don't take payments, hold deposits, verify anyone's identity,
          check that a place exists, or guarantee that anyone will do what they
          said. We have no way to get your money back if something goes wrong.
        </p>
      </Section>

      <Section title="What we ask of you">
        <p>
          Post real places you actually control, on dates you can actually
          offer. Take your listing down when it's gone. Treat people the way
          you'd want to be treated in a stranger's flat.
        </p>
        <p>
          Don't use contact details from this site for anything other than
          asking about the place. Don't post the same flat repeatedly. Don't
          scrape it.
        </p>
      </Section>

      <Section title="FLINTA-only listings">
        <p>
          Some hosts offer their place to FLINTA people only. We show that as a
          badge and trust people to respect it. Ignoring it is a good way to be
          removed from the board.
        </p>
      </Section>

      <Section title="Moderation">
        <p>
          Anyone can report a listing. We may hide listings or remove accounts
          when something is clearly wrong — a scam, a duplicate, abuse. We're a
          few volunteers, so this is best-effort rather than a service.
        </p>
      </Section>

      <Section title="Rental law">
        <p>
          Subletting in Berlin has rules, and short-term letting has more of
          them (Zweckentfremdungsverbot, among others). Whether you're allowed
          to offer a place is between you, your landlord and the city. Please
          look into it before posting.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-medium">{title}</h2>
      <div className="mt-2 space-y-3 text-ink-soft leading-relaxed">{children}</div>
    </section>
  );
}
