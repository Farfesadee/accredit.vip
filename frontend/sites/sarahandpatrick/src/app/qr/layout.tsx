import type { Metadata } from "next";

// A pass link is personal, so it is never indexed and never previewed.
export const metadata: Metadata = {
  title: "Your Entry Pass",
  robots: { index: false, follow: false },
};

export default function PassLayout({ children }: { children: React.ReactNode }) {
  return children;
}
