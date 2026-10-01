import React from "react";
import { Globe } from "lucide-react";

interface Guest {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  phone_normalized?: string;
  phone_country_code?: string;
  phone_country_flag?: string;
  phone_valid?: boolean;
  email_valid?: boolean;
  rsvp_status?: string;
  invite_sent?: boolean;
}

interface GuestListProps {
  guests: Guest[];
  loading?: boolean;
  onEditGuest?: (guest: Guest) => void;
  onDeleteGuest?: (guestId: number) => void;
}

export default function GuestList({
  guests,
  loading = false,
  onEditGuest,
  onDeleteGuest,
}: GuestListProps) {
  if (loading) {
    return <div className="text-center py-8 text-[#64748b]">Loading guests...</div>;
  }

  if (guests.length === 0) {
    return (
      <div className="text-center py-8 text-[#64748b]">
        No guests added yet. Start by adding guests manually or importing from CSV.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#e8edf2] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#e8edf2] bg-[#f8f9fc]">
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-[#64748b]">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-[#64748b]">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-[#64748b]">
                Phone
              </th>
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-[#64748b]">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-[#64748b]">
                RSVP
              </th>
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-[#64748b]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {guests.map((guest) => (
              <tr key={guest.id} className="border-b border-[#e8edf2] hover:bg-[#f8f9fc]">
                <td className="px-6 py-4 text-sm font-semibold text-[#0D1B2A]">
                  {guest.name}
                </td>
                <td className="px-6 py-4 text-sm text-[#64748b]">
                  <div className="flex items-center gap-2">
                    {guest.email || "-"}
                    {guest.email && (
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          guest.email_valid
                            ? "bg-[#f0fdf4] text-[#10b981]"
                            : "bg-[#fef2f2] text-[#ef4444]"
                        }`}
                      >
                        {guest.email_valid ? "OK" : "Invalid"}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-[#64748b]">
                  <div className="flex items-center gap-2">
                    {guest.phone_country_flag ? (
                      <span className="text-lg">{guest.phone_country_flag}</span>
                    ) : (
                      <Globe className="w-5 h-5 text-[#94a3b8]" />
                    )}
                    <div>
                      <div className="font-semibold">
                        {guest.phone_normalized || guest.phone || "-"}
                      </div>
                      {guest.phone_country_code && (
                        <div className="text-xs text-[#94a3b8]">
                          {guest.phone_country_code}
                        </div>
                      )}
                    </div>
                    {guest.phone && (
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          guest.phone_valid
                            ? "bg-[#f0fdf4] text-[#10b981]"
                            : "bg-[#fef2f2] text-[#ef4444]"
                        }`}
                      >
                        {guest.phone_valid ? "OK" : "Invalid"}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      guest.invite_sent
                        ? "bg-[#f0fdf4] text-[#10b981]"
                        : "bg-[#f0f4f8] text-[#64748b]"
                    }`}
                  >
                    {guest.invite_sent ? "Invited" : "Pending"}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      guest.rsvp_status === "yes"
                        ? "bg-[#f0fdf4] text-[#10b981]"
                        : guest.rsvp_status === "no"
                          ? "bg-[#fef2f2] text-[#ef4444]"
                          : "bg-[#f0f4f8] text-[#94a3b8]"
                    }`}
                  >
                    {guest.rsvp_status === "yes"
                      ? "Accepted"
                      : guest.rsvp_status === "no"
                        ? "Declined"
                        : "Waiting"}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    {onEditGuest && (
                      <button
                        onClick={() => onEditGuest(guest)}
                        className="text-xs font-semibold text-[#1ABC9C] hover:underline"
                      >
                        Edit
                      </button>
                    )}
                    {onDeleteGuest && (
                      <button
                        onClick={() => onDeleteGuest(guest.id)}
                        className="text-xs font-semibold text-[#ef4444] hover:underline"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
