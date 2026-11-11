import AsoEbiPage from "@/app/rsvp/asoebi/[slug]/page";

// The Aso Ebi page is imported from the platform rather than copied, so the
// two sites cannot drift apart.
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ slug: "patrick-sarah-white-wedding" }];
}

export default function Page() {
  return <AsoEbiPage />;
}
