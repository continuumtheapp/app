export const metadata = { title: "Privacy · SimbaCasa" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-prose px-4 py-12 prose-sm">
      <h1 className="text-2xl font-medium tracking-tight">Privacy</h1>
      <p className="mt-4 text-ink-soft leading-relaxed">
        This is a small, free noticeboard run for our community. We keep as
        little as possible.
      </p>

      <Section title="What we store">
        <p>
          Your Telegram account ID, your Telegram name, username and profile
          photo (Telegram shares these when you sign in), the name, photo and
          description you set on your profile, and who invited you and what you
          wrote when asking to join. We never ask for an email address. For listings: the
          text you write, your photos, the address you enter and the
          coordinates we look up from it.
        </p>
        <p>
          We record when someone presses "show contact" on a listing. That's
          how we stop people harvesting handles in bulk, and it's kept only as
          long as it's useful for that.
        </p>
      </Section>

      <Section title="What we don't store">
        <p>
          We don't ask for or store anything about your gender, including
          whether you're FLINTA. FLINTA-only listings carry a badge and there's
          a filter to see just those — nobody has to declare anything to use it.
        </p>
        <p>
          No analytics, no tracking pixels, no advertising, no third-party
          cookies. The only cookie is the one that keeps you signed in.
        </p>
      </Section>

      <Section title="Who else sees it">
        <p>
          Your contact handle is shown to signed-in people who press the button
          on your listing. Everything else on a listing is public to anyone
          with the link.
        </p>
        <p>
          The site runs on Vercel and photos are stored on Cloudflare. Sign-in
          goes through Telegram. While you type a listing's address, what
          you type, or the city you search in, is sent to Photon (by Komoot,
          using OpenStreetMap data) to suggest matching addresses and cities. Maps use OpenFreeMap. None of them get more
          than they need to do that job.
        </p>
      </Section>

      <Section title="Deleting it">
        <p>
          There's a "delete my account" button on your profile. It removes your
          account, your listings, your photos and your contact details
          immediately and permanently. No waiting.
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
