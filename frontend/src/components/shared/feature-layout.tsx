"use client";

import Link from "next/link";
import Image from "next/image";
import { ReactNode } from "react";

type Props = {
  icon: ReactNode;
  title: string;
  tag: string;
  tagColor: string;
  children: ReactNode;
};

export function FeatureLayout({ icon, title, tag, tagColor, children }: Props) {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      <header className="border-b sticky top-0 bg-white/90 backdrop-blur z-40">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <Link href="/" aria-label="Accredit Interactive home" className="flex h-14 items-center gap-2 flex-shrink-0 transition-transform duration-200 hover:scale-[1.02]">
            <Image src="/logo-mark.png" alt="" width={4086} height={801} className="h-10 w-auto object-contain sm:h-16" priority />
            <Image src="/logo-text.png" alt="Accredit Interactive" width={594} height={152} className="h-6 w-auto object-contain sm:h-8" priority />
          </Link>
          <Link href="/" className="rounded-lg border border-[rgba(13,27,42,0.18)] px-4 py-2 text-sm font-bold text-[#0D1B2A] hover:bg-[rgba(13,27,42,0.05)] transition-all duration-150">
            Back to Home
          </Link>
        </div>
      </header>

      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${tagColor}14`, color: tagColor }}>
              {icon}
            </div>
            <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full" style={{ background: `${tagColor}12`, color: tagColor }}>
              {tag}
            </span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-6" style={{ color: "#0D1B2A" }}>{title}</h1>
          {children}
        </div>
      </section>
    </div>
  );
}
