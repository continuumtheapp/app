import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { ProfileForm } from "@/components/profile-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile · Berlin Housing" };

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
      <p className="mt-1.5 text-sm text-ink-soft">{user.email}</p>

      {next && (
        <p className="card bg-accent-soft border-none px-4 py-3 mt-6 text-sm text-accent-ink">
          Add a way to reach you first — then you can post.
        </p>
      )}

      <div className="mt-6">
        <ProfileForm
          name={user.name}
          contactMethod={user.contactMethod}
          contactHandle={user.contactHandle}
          next={next ?? null}
        />
      </div>
    </div>
  );
}
