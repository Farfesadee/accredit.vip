import WeddingShell from "../../../../components/wedding-shell";

// The canonical address stays identical to the one on the platform, so an
// invitation link works whichever domain it is opened from.
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ slug: "patrick-sarah-white-wedding" }];
}

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <WeddingShell slug={slug} />;
}
