import Link from "next/link";
import { Navbar } from "@/components/shared/navbar";
import { Footer } from "@/components/shared/footer";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar variant="light" />
      <main className="flex-1 flex items-center justify-center px-4 py-24">
        <div className="text-center max-w-md">
          <p className="text-7xl font-black text-[#1ABC9C]">404</p>
          <h1 className="text-2xl font-extrabold text-[#0D1B2A] mt-4">This page is not on the guest list</h1>
          <p className="text-sm text-[#64748b] mt-2">
            The link you followed does not exist or the event has moved. Let us get you back to the action.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
            <Link href="/" className="btn-primary inline-flex h-12 items-center justify-center px-6 text-sm">
              Back to home
            </Link>
            <Link href="/attend" className="inline-flex h-12 items-center justify-center px-6 text-sm font-bold rounded-xl border border-[#d9e2ec] text-[#0D1B2A] hover:border-[#1ABC9C] hover:text-[#1ABC9C] transition-colors">
              Discover events
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
