import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, isMember } from "@/lib/session";
import { ensureInviteCode, inviteStats, inviteUrl } from "@/lib/invites";
import { InviteLink } from "@/components/invite-link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invite a friend · SimbaCasa" };

export default async function InvitePage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in?next=/invite");
  if (!isMember(user)) redirect("/join");

  const [code, stats] = await Promise.all([ensureInviteCode(user), inviteStats(user.id)]);

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-2xl font-medium tracking-tight">Invite a friend</h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        This is your personal link. Send it to anyone you'd vouch for — it
        works as many times as you like. Each person who uses it is approved by
        an admin, and is shown as invited by you.
      </p>

      <div className="mt-6">
        <InviteLink url={inviteUrl(code)} />
      </div>

      <p className="mt-6 text-sm text-ink-soft tabular-nums">
        {stats.invited === 0
          ? "Nobody has used your link yet."
          : `${stats.invited} ${stats.invited === 1 ? "person has" : "people have"} asked to join through your link: ` +
            `${stats.approved} approved, ${stats.pending} waiting, ${stats.rejected} not approved.`}
      </p>
      <p className="mt-6 text-xs text-ink-faint">
        Keep it to people you know: if someone you invited causes trouble, the
        admins will ask you about it. <Link href="/terms" className="underline underline-offset-2">Community rules</Link>
      </p>
    </div>
  );
}
