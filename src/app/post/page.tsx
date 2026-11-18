import Link from "next/link";

export const metadata = { title: "Post · SimbaCasa" };

/**
 * Offers and searches are about half and half in the group, so "Post" asks
 * which one rather than favouring either.
 */
export default function PostPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-medium tracking-tight">What do you want to post?</h1>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Choice href="/new" title="I have a place"
                text="A room or flat, for a few nights or a few months." />
        <Choice href="/requests/new" title="I'm looking for a place"
                text="Say what you need. You'll see what fits right away, and hosts can find you." />
      </div>
    </div>
  );
}

function Choice({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link href={href} className="card p-5 block hover:border-ink-faint transition-colors">
      <p className="font-medium">{title}</p>
      <p className="mt-1.5 text-sm text-ink-soft">{text}</p>
      <p className="mt-4 text-sm text-accent-ink font-medium">Continue →</p>
    </Link>
  );
}
