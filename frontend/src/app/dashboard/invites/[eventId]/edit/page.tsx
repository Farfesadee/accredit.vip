import { redirect } from "next/navigation";

export default function EditInviteEventPage({
  params,
}: {
  params: { eventId: string };
}) {
  redirect(`/dashboard/events/${params.eventId}/edit`);
}
