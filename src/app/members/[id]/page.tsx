import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { currentUser } from "@/lib/session";
import { getPublicProfile } from "@/lib/members";
import { getDb } from "@/db";
import { listings } from "@/db/schema";
import { AvatarZoom } from "@/components/avatar-zoom";
import { Avatar } from "@/components/avatar";
import { reviewsAbout } from "@/lib/stays";

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

  const reviews = await reviewsAbout(id);
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

      {/* Written reviews from people they've hosted or stayed with. */}
      <section className="mt-10">
        <h2 className="font-medium">
          Reviews{reviews.length > 0 && <span className="text-ink-faint font-normal"> · {reviews.length}</span>}
        </h2>
        {reviews.length === 0 ? (
          <p className="mt-2 text-sm text-ink-faint">No reviews yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {reviews.map((r) => (
              <article key={r.id} className="card p-4">
                <div className="flex items-center gap-2.5">
                  <Avatar name={r.author.name} image={r.author.image} size={28} />
                  <div className="min-w-0 text-sm">
                    <Link href={`/members/${r.author.id}`} className="font-medium hover:underline">
                      {r.author.name ?? "A member"}
                    </Link>
                    <span className="text-ink-faint">
                      {" "}· {r.byHost ? "hosted them" : "stayed at their place"} ·{" "}
                      {r.createdAt.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                    </span>
                  </div>
                </div>
                <p className="mt-2.5 whitespace-pre-wrap leading-relaxed">{r.body}</p>
                <p className="mt-2 text-xs text-ink-faint">{r.listingTitle}</p>
              </article>
            ))}
          </div>
        )}
      </section>

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
