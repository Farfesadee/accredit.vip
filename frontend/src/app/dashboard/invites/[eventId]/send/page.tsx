import { redirect } from "next/navigation";

export default function SendInvitesPage({
  params,
}: {
  params: { eventId: string };
}) {
  redirect(`/dashboard/events/${params.eventId}?tab=invites`);
}
