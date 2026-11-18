import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { currentUser } from "@/lib/session";
import { getPublicProfile } from "@/lib/members";
import { getDb } from "@/db";
import { listings } from "@/db/schema";
import { AvatarZoom } from "@/components/avatar-zoom";

export const dynamic = "force-dynamic";
export const metadata = { title: "Member · SimbaCasa" };

/** A member's profile, for other signed-in members. */
export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await currentUser();
  if (!viewer) redirect(`/sign-in?next=/members/${id}`);

  const isSelf = viewer.id === id;
  // Profiles are for approved members, like the rest of the full details.
  if (!isSelf && !viewer.isAdmin && viewer.memberStatus !== "member") redirect("/join");

  const person = await getPublicProfile(id);
  if (!person || person.isBanned || (person.memberStatus !== "member" && !isSelf && !viewer.isAdmin)) {
    notFound();
  }

  const places = await getDb()
    .select({ id: listings.id, title: listings.title })
    .from(listings)
    .where(and(eq(listings.hostId, id), eq(listings.status, "published")))
    .orderBy(desc(listings.createdAt))
    .limit(20);

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <div className="flex items-center gap-4">
        <AvatarZoom name={person.name} image={person.image} size={80} />
        <div className="min-w-0">
          <h1 className="text-2xl font-medium tracking-tight">{person.name ?? "A member"}</h1>
          <p className="mt-0.5 text-sm text-ink-faint">
            Member since {new Date(person.createdAt).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      {person.bio ? (
        <p className="mt-6 whitespace-pre-wrap leading-relaxed text-ink-soft">{person.bio}</p>
      ) : (
        <p className="mt-6 text-sm text-ink-faint">
          {isSelf ? "You haven't written anything about yourself yet." : "No description yet."}
        </p>
      )}
      {isSelf && (
        <Link href="/profile" className="btn btn-secondary mt-4">Edit profile</Link>
      )}

      {places.length > 0 && (
        <section className="mt-10">
          <h2 className="font-medium">Places</h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            {places.map((p) => (
              <li key={p.id}>
                <Link href={`/listing/${p.id}`} className="hover:underline">{p.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
