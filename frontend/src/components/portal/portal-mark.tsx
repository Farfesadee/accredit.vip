import { PORTAL, PORTAL_INITIALS, PORTAL_ACCENT } from "@/lib/portal";

// The couple's wordmark for their own dashboard: their initials in a gold ring
// and their names beside it once the sidebar is open. Rendered only when the
// portal build sets NEXT_PUBLIC_PORTAL_NAME.
export function PortalMark({ open }: { open: boolean }) {
  return (
    <span className="flex items-center gap-2 min-w-0 overflow-hidden">
      <span
        className="h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-full font-serif text-sm font-bold"
        style={{ background: "rgba(201,162,39,0.14)", color: PORTAL_ACCENT, border: `1px solid ${PORTAL_ACCENT}` }}
      >
        {PORTAL_INITIALS}
      </span>
      {open && <span className="font-serif text-white text-[15px] leading-tight truncate">{PORTAL}</span>}
    </span>
  );
}
