import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { getRequest } from "@/lib/requests";
import { RequestForm } from "@/components/request-form";
import { DeleteButton } from "@/components/delete-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit request · SimbaCasa" };

export default async function EditRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const user = await currentUser();
  if (!user) redirect(`/sign-in?next=/requests/${id}/edit`);

  const request = await getRequest(id);
  if (!request || request.seekerId !== user.id) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-medium tracking-tight">Edit request</h1>
      <div className="mt-5">
        <DeleteButton endpoint={`/api/requests/${request.id}`} what="request" />
      </div>
      <div className="mt-8">
        <RequestForm existing={request} />
      </div>
    </div>
  );
}
