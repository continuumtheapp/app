import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { currentUser } from "@/lib/session";
import { getDb } from "@/db";
import { reports, listings, users } from "@/db/schema";
import { allMembers, pendingJoinRequests } from "@/lib/members";
import { AdminActions } from "@/components/admin-actions";
import { JoinReviewActions, IdReviewActions } from "@/components/join-review-actions";
import { pendingIdChecks } from "@/lib/id-check";
import { AvatarZoom } from "@/components/avatar-zoom";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · SimbaCasa" };

const host = alias(users, "host");
const hostInviter = alias(users, "host_inviter");

const date = (d: Date | null) => (d ? new Date(d).toLocaleDateString("en-GB") : "");
const who = (u: { name: string | null; telegramHandle: string | null }) =>
  [u.name, u.telegramHandle].filter(Boolean).join(" · ") || "a member";

export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in?next=/admin");
  if (!user.isAdmin) redirect("/");

  const [requests, idChecks, members, rows] = await Promise.all([
    pendingJoinRequests(),
    pendingIdChecks(),
    allMembers(),
    getDb()
      .select({
        report: reports,
        listing: { id: listings.id, title: listings.title, status: listings.status, hostId: listings.hostId },
        reporter: { name: users.name, telegramHandle: users.telegramHandle },
        host: { name: host.name, telegramHandle: host.telegramHandle },
        hostInviter: { name: hostInviter.name, telegramHandle: hostInviter.telegramHandle },
      })
      .from(reports)
      .innerJoin(listings, eq(reports.listingId, listings.id))
      .innerJoin(users, eq(reports.reporterId, users.id))
      .innerJoin(host, eq(listings.hostId, host.id))
      .leftJoin(hostInviter, eq(host.invitedById, hostInviter.id))
      .orderBy(desc(reports.createdAt))
      .limit(100),
  ]);

  const open = rows.filter((r) => r.report.status === "open");
  const closed = rows.filter((r) => r.report.status !== "open");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-medium tracking-tight">Join requests</h1>
      {requests.length === 0 ? (
        <p className="card p-8 mt-6 text-center text-ink-soft">Nobody waiting.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {requests.map(({ person, inviter }) => (
            <article key={person.id} className="card p-4">
              <div>
                <div className="flex gap-3 min-w-0">
                  <AvatarZoom name={person.name} image={person.image} size={44} />
                  <div className="min-w-0">
                    <p className="font-medium">{who(person)}</p>
                    <p className="mt-1 text-sm">
                      {inviter ? (
                        <>
                          Invited by <span className="font-medium">{who(inviter)}</span>
                          <span className="text-ink-faint tabular-nums">
                            {" "}— has invited {inviter.invitedCount}, {inviter.approvedCount} approved
                            {inviter.bannedCount > 0 && `, ${inviter.bannedCount} banned`}
                          </span>
                        </>
                      ) : (
                        <span className="text-ink-soft">No invite link: says they're already in the Telegram group</span>
                      )}
                    </p>
                    {person.bio && (
                      <p className="mt-2 text-sm text-ink-soft whitespace-pre-wrap">{person.bio}</p>
                    )}
                    <p className="mt-1.5 text-xs text-ink-faint">
                      Asked {date(person.joinRequestedAt)}
                      {!person.telegramHandle && " · no Telegram username yet"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <JoinReviewActions userId={person.id} name={person.name ?? "this person"} />
              </div>
            </article>
          ))}
        </div>
      )}

      <h2 className="mt-12 text-xl font-medium tracking-tight">ID checks</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Compare the ID with the selfie. Either answer deletes both photos; only
        the result, the date and your name are kept. Links work for 5 minutes:
        reload the page if they've stopped.
      </p>
      {idChecks.length === 0 ? (
        <p className="card p-8 mt-6 text-center text-ink-soft">Nobody waiting.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {idChecks.map((p) => (
            <article key={p.id} className="card p-4">
              <div className="min-w-0">
                <p className="font-medium">{who(p)}</p>
                <p className="mt-0.5 text-xs text-ink-faint">Sent {date(p.idSubmittedAt)}</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[p.docUrl, p.selfieUrl].map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={i === 0 ? "ID" : "Selfie"} referrerPolicy="no-referrer"
                         className="w-full h-48 sm:h-64 rounded-lg border border-line object-contain bg-paper" />
                    <span className="mt-1 block text-xs text-ink-faint">{i === 0 ? "ID" : "Selfie"}</span>
                  </a>
                ))}
              </div>
              <div className="mt-4">
                <IdReviewActions userId={p.id} name={p.name ?? "this person"} />
              </div>
            </article>
          ))}
        </div>
      )}

      <h2 className="mt-12 text-xl font-medium tracking-tight">Reports</h2>
      {open.length === 0 ? (
        <p className="card p-8 mt-6 text-center text-ink-soft">Nothing to look at.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {open.map(({ report, listing, reporter, host, hostInviter }) => (
            <article key={report.id} className="card p-4">
              <div>
                <div className="min-w-0">
                  <Link href={`/listing/${listing.id}`} className="font-medium hover:underline">
                    {listing.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    Posted by {who(host)}
                    {hostInviter?.name || hostInviter?.telegramHandle
                      ? `, invited by ${who(hostInviter)}`
                      : ", no inviter on record"}
                  </p>
                  <p className="mt-1 text-sm text-ink-soft whitespace-pre-wrap">{report.reason}</p>
                  <p className="mt-1.5 text-xs text-ink-faint">
                    from {reporter.telegramHandle ?? reporter.name ?? "a member"} · {date(new Date(report.createdAt))}
                    {listing.status === "hidden" && " · listing already hidden"}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <AdminActions reportId={report.id} listingId={listing.id}
                              hostId={listing.hostId} hidden={listing.status === "hidden"} />
              </div>
            </article>
          ))}
        </div>
      )}

      {closed.length > 0 && (
        <details className="mt-6">
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

      <h2 className="mt-12 text-xl font-medium tracking-tight">Members</h2>
      <p className="mt-1 text-sm text-ink-soft tabular-nums">
        {members.filter((m) => m.person.memberStatus === "member").length} members
      </p>
      <div className="mt-4 card divide-y divide-line">
        {members.map(({ person, inviter }) => (
          <div key={person.id} className="p-3 flex items-center gap-3 text-sm">
            <AvatarZoom name={person.name} image={person.image} size={32} />
            <div className="min-w-0 flex-1">
              <p className="truncate">
                <Link href={`/members/${person.id}`} className="font-medium hover:underline">
                  {person.name ?? "No name"}
                </Link>
                {person.telegramHandle && <span className="text-ink-faint"> {person.telegramHandle}</span>}
              </p>
              <p className="text-xs text-ink-faint truncate">
                {inviter ? `Invited by ${who(inviter)}` : "No inviter (founding group member)"}
                {" · since "}{date(person.createdAt)}
                {person.idCheckStatus === "verified" &&
                  ` · ID checked ${date(person.idCheckedAt)}${person.idCheckedBy ? ` by ${person.idCheckedBy}` : ""}`}
              </p>
            </div>
            <span className="text-xs text-ink-soft shrink-0">
              {person.isBanned ? "Banned"
                : person.memberStatus === "member" ? ""
                : person.memberStatus === "rejected" ? "Rejected"
                : person.joinRequestedAt ? "Waiting" : "Hasn't asked"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
