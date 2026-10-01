import { redirect } from "next/navigation";

export default function ManageInvitesPage({
  params,
}: {
  params: { eventId: string };
}) {
  redirect(`/dashboard/events/${params.eventId}?tab=invites`);
}
