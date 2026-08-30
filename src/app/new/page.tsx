import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { ListingForm } from "@/components/listing-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Post a place · Continuum" };

export default async function NewListingPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in?next=/new");
  // A listing nobody can reply to is useless, so the handle comes first.
  if (!user.contactHandle) redirect("/profile?next=/new");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-medium tracking-tight">Post a place</h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        People will message you directly on {user.contactMethod === "telegram" ? "Telegram" : "WhatsApp"}.
      </p>
      <div className="mt-8">
        <ListingForm />
      </div>
    </div>
  );
}
