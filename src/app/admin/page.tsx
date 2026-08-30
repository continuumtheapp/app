import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { currentUser } from "@/lib/session";
import { getDb } from "@/db";
import { reports, listings, users } from "@/db/schema";
import { AdminActions } from "@/components/admin-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Berlin Housing" };

export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in?next=/admin");
  if (!user.isAdmin) redirect("/");

  const rows = await getDb()
    .select({
      report: reports,
      listing: { id: listings.id, title: listings.title, status: listings.status, hostId: listings.hostId },
      reporter: { email: users.email },
    })
    .from(reports)
    .innerJoin(listings, eq(reports.listingId, listings.id))
    .innerJoin(users, eq(reports.reporterId, users.id))
    .orderBy(desc(reports.createdAt))
    .limit(100);

  const open = rows.filter((r) => r.report.status === "open");
  const closed = rows.filter((r) => r.report.status !== "open");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-medium tracking-tight">Reports</h1>

      {open.length === 0 ? (
        <p className="card p-8 mt-6 text-center text-ink-soft">Nothing to look at.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {open.map(({ report, listing, reporter }) => (
            <article key={report.id} className="card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link href={`/listing/${listing.id}`} className="font-medium hover:underline">
                    {listing.title}
                  </Link>
                  <p className="mt-1 text-sm text-ink-soft whitespace-pre-wrap">{report.reason}</p>
                  <p className="mt-1.5 text-xs text-ink-faint">
                    from {reporter.email} · {new Date(report.createdAt).toLocaleDateString("en-GB")}
                    {listing.status === "hidden" && " · listing already hidden"}
                  </p>
                </div>
                <AdminActions reportId={report.id} listingId={listing.id}
                              hostId={listing.hostId} hidden={listing.status === "hidden"} />
              </div>
            </article>
          ))}
        </div>
      )}

      {closed.length > 0 && (
        <details className="mt-10">
          <summary className="text-sm text-ink-soft cursor-pointer">
            {closed.length} resolved
          </summary>
          <div className="mt-3 space-y-2">
            {closed.map(({ report, listing }) => (
              <p key={report.id} className="text-sm text-ink-faint">
                <span className="capitalize">{report.status}</span> · {listing.title}
              </p>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
