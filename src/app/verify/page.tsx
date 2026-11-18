import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, isMember } from "@/lib/session";
import { hasContact } from "@/lib/contact";
import { IdCheckForm } from "@/components/id-check-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "ID check · SimbaCasa" };

/** Only paths on this site, so the link can't send people elsewhere. */
const safeNext = (next: string | undefined) =>
  next && next.startsWith("/") && !next.startsWith("//") ? next : "/post";

export default async function VerifyPage({ searchParams }: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNext((await searchParams).next);
  const user = await currentUser();
  if (!user) redirect(`/sign-in?next=/verify?next=${encodeURIComponent(next)}`);
  if (!isMember(user)) redirect("/join");
  if (!hasContact(user)) redirect(`/profile?next=/verify`);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-medium tracking-tight">ID check</h1>
      <p className="mt-1.5 text-sm text-ink-soft max-w-prose">
        Before you publish a place or a search, an admin checks who you are.
        It's what lets everyone trust that the person behind a post is real.
        Browsing and contacting people don't need it.
      </p>

      <div className="mt-8">
        {user.idCheckStatus === "verified" ? (
          <div className="card p-5">
            <p className="text-sm">Your ID is checked. You can publish.</p>
            <Link href={next} className="btn btn-primary mt-4">Continue</Link>
          </div>
        ) : user.idCheckStatus === "submitted" ? (
          <div className="card p-5 text-sm text-ink-soft">
            Thanks, your photos are with the admins. We'll message you on
            Telegram once they've looked at them.
          </div>
        ) : (
          <>
            {user.idCheckStatus === "rejected" && (
              <p className="card bg-paper p-4 mb-4 text-sm text-ink-soft">
                The admins couldn't confirm your ID from the last photos. You
                can send new ones.
              </p>
            )}
            <IdCheckForm />
          </>
        )}
      </div>

      <section className="mt-8 text-sm text-ink-soft max-w-prose space-y-2">
        <h2 className="font-medium text-ink">What happens to the photos</h2>
        <p>
          They're stored privately, only an admin can open them, and only for a
          few minutes at a time. As soon as the check is done, both photos are
          deleted. We keep only that your ID was checked, when, and by which
          admin.
        </p>
      </section>
    </div>
  );
}
