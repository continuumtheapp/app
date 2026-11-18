import { redirect } from "next/navigation";
import { currentUser, isMember, isIdVerified } from "@/lib/session";
import { hasContact } from "@/lib/contact";
import { RequestForm } from "@/components/request-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Look for a place · SimbaCasa" };

export default async function NewRequestPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in?next=/requests/new");
  if (!isMember(user)) redirect("/join");
  // Hosts reply in chat, so the handle comes first — same as posting a place.
  if (!hasContact(user)) redirect("/profile?next=/requests/new");
  // Publishing an offer or a search needs an ID an admin has checked.
  if (!isIdVerified(user)) redirect("/verify?next=/requests/new");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-medium tracking-tight">Look for a place</h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        Say what you need. We'll show you the places that fit right away, and
        hosts can see your profile when they reach out.
      </p>
      <div className="mt-8">
        <RequestForm />
      </div>
    </div>
  );
}
