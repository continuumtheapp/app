import Link from "next/link";
import { currentUser } from "@/lib/session";

export async function SiteHeader() {
  const user = await currentUser().catch(() => null);

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="font-medium tracking-tight shrink-0">
          Continuum
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          {user ? (
            <>
              <Link href="/my-listings" className="px-3 py-1.5 rounded-lg hover:bg-paper text-ink-soft hover:text-ink">
                My listings
              </Link>
              {user.isAdmin && (
                <Link href="/admin" className="px-3 py-1.5 rounded-lg hover:bg-paper text-ink-soft hover:text-ink">
                  Admin
                </Link>
              )}
              <Link href="/profile" className="px-3 py-1.5 rounded-lg hover:bg-paper text-ink-soft hover:text-ink">
                Profile
              </Link>
              <Link href="/new" className="btn btn-primary ml-1">Post a place</Link>
            </>
          ) : (
            <Link href="/sign-in" className="btn btn-primary">Sign in</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
