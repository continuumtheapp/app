import Link from "next/link";
import Image from "next/image";
import { currentUser, isMember } from "@/lib/session";

export async function SiteHeader() {
  const user = await currentUser().catch(() => null);

  return (
    // Petrol, like the logo's own background, so the mark sits in it seamlessly.
    <header className="bg-accent text-white">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-2">
        {/* On phones just the mark, so the links and "Post" still fit. */}
        <Link href="/" aria-label="SimbaCasa home"
              className="flex items-center gap-2 font-medium tracking-tight shrink-0">
          <Image src="/brand-mark.png" alt="" width={32} height={32} priority />
          <span className="hidden sm:inline">SimbaCasa</span>
        </Link>

        <nav className="flex items-center sm:gap-1 text-sm">
          {user ? (
            <>
              <Link href="/my-listings" className="px-2 sm:px-3 py-1.5 whitespace-nowrap rounded-lg text-white/80 hover:text-white hover:bg-white/10">
                My posts
              </Link>
              {user.isAdmin && (
                <Link href="/admin" className="px-2 sm:px-3 py-1.5 whitespace-nowrap rounded-lg text-white/80 hover:text-white hover:bg-white/10">
                  Admin
                </Link>
              )}
              {/* Hidden on phones, where it would push "Post" off screen;
                  the profile page links to it there. */}
              {isMember(user) && (
                <Link href="/invite" className="hidden md:block px-2 sm:px-3 py-1.5 whitespace-nowrap rounded-lg text-white/80 hover:text-white hover:bg-white/10">
                  Invite
                </Link>
              )}
              <Link href="/profile" className="px-2 sm:px-3 py-1.5 whitespace-nowrap rounded-lg text-white/80 hover:text-white hover:bg-white/10">
                Profile
              </Link>
              <Link href="/post" className="btn btn-gold ml-1 shrink-0">Post</Link>
            </>
          ) : (
            <Link href="/sign-in" className="btn btn-gold">Sign in</Link>
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
