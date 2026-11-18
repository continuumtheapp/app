import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { ProfileForm } from "@/components/profile-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile · SimbaCasa" };

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in?next=/profile");
  const { next } = await searchParams;

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-2xl font-medium tracking-tight">Your profile</h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        {user.telegramHandle ?? "Signed in with Telegram"}
        {" · "}
        <Link href={`/members/${user.id}`} className="underline underline-offset-2 hover:text-ink">
          See your public profile
        </Link>
        {user.memberStatus === "member" && (
          <>
            {" · "}
            <Link href="/invite" className="underline underline-offset-2 hover:text-ink">
              Invite a friend
            </Link>
          </>
        )}
      </p>

      {!user.telegramHandle && (
        <div className="card bg-accent-soft border-none px-4 py-3 mt-6 text-sm text-accent-ink">
          <p className="font-medium">
            {next ? "Set a Telegram username first — then you can post." : "You don't have a Telegram username yet."}
          </p>
          <p className="mt-1">
            Members reach each other through Telegram usernames. Add one in
            Telegram (Settings → Username), then sign out and sign in again here.
          </p>
        </div>
      )}

      <div className="mt-6">
        <ProfileForm
          name={user.name}
          bio={user.bio}
          image={user.image}
          telegramHandle={user.telegramHandle}
          next={next ?? null}
        />
      </div>
    </div>
  );
}
