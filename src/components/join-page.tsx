import Link from "next/link";
import { Suspense } from "react";
import type { User } from "@/db/schema";
import { isTelegramConfigured } from "@/lib/env";
import { DEV_TEST_MEMBERS, isDevSignInEnabled, testSignInNeedsCode } from "@/lib/dev-sign-in";
import { SignInForm } from "./sign-in-form";
import { JoinForm } from "./join-form";
import { AvatarZoom } from "./avatar-zoom";

/**
 * The join flow, shared by /join/<code> (through a member's invite link) and
 * /join (someone already in the Telegram group, or checking their status).
 */
export function JoinPage({
  viewer, code, inviter,
}: {
  viewer: User | null;
  code: string | null;
  inviter: { name: string | null; image: string | null } | null;
}) {
  const inviterName = inviter?.name ?? (inviter ? "a member" : null);
  const here = code ? `/join/${code}` : "/join";

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      {inviter ? (
        <div className="flex items-center gap-3">
          <AvatarZoom name={inviter.name} image={inviter.image} size={48} />
          <h1 className="text-2xl font-medium tracking-tight text-balance">
            {inviterName} invited you to SimbaCasa
          </h1>
        </div>
      ) : (
        <h1 className="text-2xl font-medium tracking-tight">Join SimbaCasa</h1>
      )}
      <p className="mt-3 text-sm text-ink-soft">
        SimbaCasa is a community for finding and offering rooms and flats,
        member to member. Every new member is approved by an admin.
      </p>

      <div className="mt-8">
        <Step viewer={viewer} code={code} here={here} />
      </div>
    </div>
  );
}

function Step({ viewer, code, here }: {
  viewer: User | null; code: string | null; here: string;
}) {
  if (!viewer) {
    return (
      <>
        <p className="mb-3 text-sm font-medium">1. Sign in with Telegram</p>
        <Suspense fallback={<div className="card h-40 animate-pulse" />}>
          <SignInForm telegram={isTelegramConfigured()} next={here}
                      testMembers={isDevSignInEnabled() ? [...DEV_TEST_MEMBERS] : []} needsCode={testSignInNeedsCode()} />
        </Suspense>
        <p className="mt-3 text-xs text-ink-faint">Then you'll fill in your profile: a photo, your name and a few lines about you.</p>
      </>
    );
  }

  if (viewer.memberStatus === "member") {
    return (
      <Notice title="You're already a member.">
        <Link href="/" className="underline underline-offset-2">Go to SimbaCasa</Link>
        {" · "}
        <Link href="/invite" className="underline underline-offset-2">Invite a friend</Link>
      </Notice>
    );
  }

  if (viewer.memberStatus === "rejected") {
    return <Notice title="Your request to join wasn't approved.">
      If you think this is a mistake, talk to the person who invited you.
    </Notice>;
  }

  if (viewer.joinRequestedAt) {
    return (
      <Notice title="Thanks, your request is in.">
        An admin will look at it soon. Meanwhile you can{" "}
        <Link href="/" className="underline underline-offset-2">browse places</Link>
        {" "}or{" "}
        <Link href="/profile" className="underline underline-offset-2">edit your profile</Link>.
      </Notice>
    );
  }

  return (
    <>
      <p className="mb-1 text-sm font-medium">{viewer.name ? `Hi ${viewer.name}! ` : ""}Fill in your profile</p>
      <p className="mb-3 text-sm text-ink-soft">This is what members and the admins will see.</p>
      {!code && (
        <p className="mb-3 text-sm text-ink-soft">
          No invite link? If you're already in the SimbaCasa Telegram group, ask
          here. Otherwise, ask a member for their invite link.
        </p>
      )}
      <JoinForm code={code} defaultName={viewer.name} defaultBio={viewer.bio} defaultImage={viewer.image} />
    </>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <p className="font-medium">{title}</p>
      <p className="mt-1.5 text-sm text-ink-soft">{children}</p>
    </div>
  );
}
