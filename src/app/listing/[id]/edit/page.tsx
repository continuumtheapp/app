import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { getListing } from "@/lib/listings";
import { ListingForm } from "@/components/listing-form";

export const dynamic = "force-dynamic";

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const user = await currentUser();
  if (!user) redirect(`/sign-in?next=/listing/${id}/edit`);

  const listing = await getListing(id);
  if (!listing) notFound();
  if (listing.hostId !== user.id) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-medium tracking-tight">Edit listing</h1>
      <div className="mt-8">
        <ListingForm existing={listing} />
      </div>
    </div>
  );
}
