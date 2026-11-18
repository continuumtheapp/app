import Link from "next/link";
import { currentUser } from "@/lib/session";
import { findInviter } from "@/lib/invites";
import { JoinPage } from "@/components/join-page";

export const dynamic = "force-dynamic";
export const metadata = { title: "You're invited · SimbaCasa" };

/** A member's personal invite link. */
export default async function JoinThroughInvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [viewer, inviter] = await Promise.all([currentUser(), findInviter(code)]);

  if (!inviter) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-2xl font-medium tracking-tight">This invite link doesn't work</h1>
        <p className="mt-3 text-sm text-ink-soft">
          It may have been mistyped, or the person who shared it is no longer a
          member. Ask them for a new one, or{" "}
          <Link href="/join" className="underline underline-offset-2">join another way</Link>.
        </p>
      </div>
    );
  }

  return <JoinPage viewer={viewer} code={code} inviter={inviter} />;
}
