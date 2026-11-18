import Link from "next/link";
import { currentUser, isMember } from "@/lib/session";

export async function SiteHeader() {
  const user = await currentUser().catch(() => null);

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-2">
        <Link href="/" className="font-medium tracking-tight shrink-0">
          SimbaCasa
        </Link>

        <nav className="flex items-center sm:gap-1 text-sm">
          {user ? (
            <>
              <Link href="/my-listings" className="px-2 sm:px-3 py-1.5 whitespace-nowrap rounded-lg hover:bg-paper text-ink-soft hover:text-ink">
                My posts
              </Link>
              {user.isAdmin && (
                <Link href="/admin" className="px-2 sm:px-3 py-1.5 whitespace-nowrap rounded-lg hover:bg-paper text-ink-soft hover:text-ink">
                  Admin
                </Link>
              )}
              {/* Hidden on phones, where it would push "Post" off screen;
                  the profile page links to it there. */}
              {isMember(user) && (
                <Link href="/invite" className="hidden md:block px-2 sm:px-3 py-1.5 whitespace-nowrap rounded-lg hover:bg-paper text-ink-soft hover:text-ink">
                  Invite
                </Link>
              )}
              <Link href="/profile" className="px-2 sm:px-3 py-1.5 whitespace-nowrap rounded-lg hover:bg-paper text-ink-soft hover:text-ink">
                Profile
              </Link>
              <Link href="/post" className="btn btn-primary ml-1 shrink-0">Post</Link>
            </>
          ) : (
            <Link href="/sign-in" className="btn btn-primary">Sign in</Link>
          )}
        </nav>
      </div>

      {user && !isMember(user) && (
        <div className="bg-accent-soft text-accent-ink text-sm">
          <div className="mx-auto max-w-6xl px-4 py-2">
            {user.memberStatus === "rejected"
              ? "Your request to join wasn't approved."
              : user.joinRequestedAt
                ? "Your membership is waiting for an admin's approval. You can browse meanwhile."
                : <>You're not a member yet. <Link href="/join" className="underline underline-offset-2 font-medium">Ask to join</Link></>}
          </div>
        </div>
      )}
    </header>
  );
}
