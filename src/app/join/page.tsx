import { currentUser } from "@/lib/session";
import { JoinPage } from "@/components/join-page";

export const dynamic = "force-dynamic";
export const metadata = { title: "Join · SimbaCasa" };

/** Joining without an invite link, or checking where your request stands. */
export default async function JoinWithoutInvitePage() {
  const viewer = await currentUser();
  return <JoinPage viewer={viewer} code={null} inviter={null} />;
}
