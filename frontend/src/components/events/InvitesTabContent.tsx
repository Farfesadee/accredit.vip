"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { Send, AlertCircle, Lightbulb, CheckCircle, AlertTriangle, Loader, Mail, Download, MessageSquare, Save } from "lucide-react";
import type { JSX } from "react";

type Guest = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  rsvp_status: string;
  rsvp_note?: string | null;
  invite_sent: boolean;
  invite_attempts?: number;
  invite_viewed_at?: string | null;
  notes?: string | null;
  tags?: string[];
  qr_token?: string | null;
  custom_data?: Record<string, any>;
};

type SendResult = {
  channels?: Record<string, any>;
  total_sent?: number;
  total_guests?: number;
};

type BatchResult = {
  sent: number;
  total: number;
  remaining: number;
  batchGuests: string;
  error?: string;
};

type InvitesTabContentProps = {
  eventId: string;
  channels: string[];
  setChannels: (v: string[]) => void;
  sending: boolean;
  canSendInvites: boolean;
  sendInvites: (force?: boolean) => Promise<void>;
  sendAllQrs: () => Promise<void>;
  testSend: (messageSubject?: string, messageBody?: string) => Promise<void>;
  sendResult: SendResult | null;
  sendError: string | null;
  logs: any[];
  guests: Guest[];
  invalidPhoneGuests: Guest[];
  guestsWithMissingContact: Guest[];
  guestCountRange?: string | null;
  exportingMsg?: boolean;
  exportMsgStatus?: string;
  setExportMsgStatus?: (v: string) => void;
  exportMsgChannel?: string;
  setExportMsgChannel?: (v: string) => void;
  exportMessages?: () => Promise<void>;
  onDataChange?: () => void;
  inviteSubject?: string | null;
  inviteBody?: string | null;
  onSaveInviteMessage?: (subject: string, body: string) => Promise<void>;
};

const CHANNEL_OPTIONS = [
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS" },
];

const PRICE_TABLE: Record<string, Record<string, number>> = {
  "1-100": { email: 100000, whatsapp: 200000, sms: 300000 },
  "101-200": { email: 200000, whatsapp: 350000, sms: 500000 },
  "201-400": { email: 350000, whatsapp: 500000, sms: 750000 },
  "400+": { email: 500000, whatsapp: 750000, sms: 1000000 },
};

function calculateTotalPrice(guestRange: string, chs: string[]): number {
  const prices = PRICE_TABLE[guestRange] || PRICE_TABLE["1-100"];
  return chs.reduce((sum, ch) => sum + (prices[ch] || 0), 0);
}

export default function InvitesTabContent({
  eventId,
  channels,
  setChannels,
  sending,
  canSendInvites,
  sendInvites,
  sendAllQrs,
  testSend,
  sendResult,
  sendError,
  logs,
  guests,
  invalidPhoneGuests,
  guestsWithMissingContact,
  guestCountRange,
  exportingMsg,
  exportMsgStatus = "all",
  setExportMsgStatus,
  exportMsgChannel = "all",
  setExportMsgChannel,
  exportMessages,
  onDataChange,
  inviteSubject,
  inviteBody,
  onSaveInviteMessage,
}: InvitesTabContentProps) {
  const phoneSelected = channels.some((c) => c === "whatsapp" || c === "sms");
  const emailSelected = channels.includes("email");
  const totalPrice = guestCountRange ? calculateTotalPrice(guestCountRange, channels) : 0;
  const [targetFilter, setTargetFilter] = useState("all");
  const [customSubject, setCustomSubject] = useState(inviteSubject || "");
  const [customBody, setCustomBody] = useState(inviteBody || "");
  const [savingMessage, setSavingMessage] = useState(false);
  const [messageSaved, setMessageSaved] = useState(false);
  const [showResendModal, setShowResendModal] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [batchSending, setBatchSending] = useState(false);
  const [qrBatchResult, setQrBatchResult] = useState<BatchResult | null>(null);
  const [qrBatchSending, setQrBatchSending] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [resendSending, setResendSending] = useState(false);
  const [resendResult, setResendResult] = useState<SendResult | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);

  useEffect(() => {
    setBatchResult(null);
    setQrBatchResult(null);
  }, [guests.length, channels]);

  const unsentGuests = guests.filter((g) => !g.invite_sent);
  const unsentWithContact = unsentGuests.filter((g) => {
    const hasEmail = emailSelected && !!g.email;
    const hasPhone = phoneSelected && !!g.phone;
    if (emailSelected && phoneSelected) return hasEmail || hasPhone;
    if (emailSelected) return hasEmail;
    if (phoneSelected) return hasPhone;
    return false;
  });
  const batchSize = Math.min(5, unsentWithContact.length);
  const remainingAfterBatch = unsentWithContact.length - batchSize;

  const sendBatchInvites = async () => {
    if (batchSize === 0) return;
    setBatchSending(true);
    setBatchResult(null);
    try {
      const batchIds = unsentWithContact.slice(0, 5).map((g) => g.id);
      const body: any = { channel: "email", channels, guest_ids: batchIds };
      if (customSubject) body.message_subject = customSubject;
      if (customBody) body.message_body = customBody;
      const res = await apiClient<any>(`/events/${eventId}/send-invites-batch`, { method: "POST", body });
      const totalSent = Object.values(res.channels || {}).reduce((sum: number, ch: any) => sum + (ch.sent || 0), 0);
      const remaining = Math.max(0, unsentWithContact.length - 5);
      setBatchResult({
        sent: totalSent,
        total: batchIds.length,
        remaining,
        batchGuests: batchIds.length > 0 ? guests.filter((g) => batchIds.includes(g.id)).map((g) => g.name).join(", ") : "",
      });
      onDataChange?.();
    } catch (err: any) {
      const msg = err.detail?.message || err.message || "Failed to send batch";
      setBatchResult({ sent: 0, total: 0, remaining: 0, batchGuests: "", error: msg });
    }
    setBatchSending(false);
  };

  const handleResendAll = async () => {
    setShowResendModal(false);
    setResendSending(true);
    setResendResult(null);
    setResendError(null);
    try {
      const body: any = { channels };
      if (customSubject) body.message_subject = customSubject;
      if (customBody) body.message_body = customBody;
      const res = await apiClient<any>(`/events/${eventId}/send-invites?force=true`, { method: "POST", body });
      setResendResult(res);
      onDataChange?.();
    } catch (err: any) {
      const msg = err.detail?.message || err.message || "Failed to resend";
      setResendError(msg);
    }
    setResendSending(false);
  };

  const handleTestSend = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      await testSend(customSubject || undefined, customBody || undefined);
      setTestResult("Test message sent! Check your inbox/phone.");
    } catch (err: any) {
      setTestResult(err.message || "Test send failed. Check your contact info.");
    }
    setTestLoading(false);
  };

  const matchedGuests = guests.filter((g) => {
    if (targetFilter === "all") return true;
    if (targetFilter === "accepted") return g.rsvp_status === "accepted";
    if (targetFilter === "pending") return g.rsvp_status === "pending";
    if (targetFilter === "declined") return g.rsvp_status === "declined";
    if (targetFilter === "not_sent") return !g.invite_sent;
    if (targetFilter === "no_contact") {
      const missingEmail = emailSelected && !g.email;
      const missingPhone = phoneSelected && !g.phone;
      return missingEmail || missingPhone;
    }
    return true;
  });

  const acceptedCount = guests.filter((g) => g.rsvp_status === "accepted").length;
  const pendingCount = guests.filter((g) => g.rsvp_status === "pending").length;
  const declinedCount = guests.filter((g) => g.rsvp_status === "declined").length;
  const notSentCount = guests.filter((g) => !g.invite_sent).length;
  const noContactCount = guests.filter((g) => {
    const missingEmail = emailSelected && !g.email;
    const missingPhone = phoneSelected && !g.phone;
    return missingEmail || missingPhone;
  }).length;

  const messageEditor = (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-secondary flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Customize Invite Message
        </h3>
        <button
          onClick={async () => {
            if (!onSaveInviteMessage) return;
            setSavingMessage(true);
            setMessageSaved(false);
            try {
              await onSaveInviteMessage(customSubject.trim(), customBody.trim());
              setMessageSaved(true);
              setTimeout(() => setMessageSaved(false), 3000);
            } finally {
              setSavingMessage(false);
            }
          }}
          disabled={savingMessage || !onSaveInviteMessage}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-white text-xs font-semibold hover:bg-secondary/80 transition-colors disabled:opacity-50"
        >
          {savingMessage ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {messageSaved ? "Saved!" : "Save message"}
        </button>
      </div>
      <p className="text-xs text-slate-500">
        This message is saved to the event and will be used for <strong>all invite sends</strong> (batch sends, resends, and per-guest invites) until you change it.
      </p>
      <div>
        <label className="text-xs font-medium text-slate-600 mb-1 block">Subject Line</label>
        <input
          placeholder="e.g. You're Invited: {{ event_title }}"
          value={customSubject}
          onChange={(e) => setCustomSubject(e.target.value)}
          className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-slate-400"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-600 mb-1 block">Message Body</label>
        <textarea
          placeholder="Write your invitation message here..."
          value={customBody}
          onChange={(e) => setCustomBody(e.target.value)}
          rows={5}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />
      </div>
      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Available Variables</p>
        <div className="flex flex-wrap gap-1.5 text-[10px]">
          {["{{ guest_name }}", "{{ event_title }}", "{{ event_date }}", "{{ event_time }}", "{{ venue }}", "{{ rsvp_link }}", "{{ host_name }}", "{{ dress_code }}"].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setCustomBody((prev) => prev + v)}
              className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 font-mono hover:bg-primary hover:text-white hover:border-primary transition-colors"
            >
              {v}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSectionTitle = (icon: JSX.Element, title: string) => (
    <h2 className="text-base font-bold text-secondary mb-4 flex items-center gap-2">
      {icon}
      {title}
    </h2>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-blue-600 mb-1">Total Guests</p>
              <p className="text-2xl font-bold text-blue-900">{guests.length}</p>
            </div>
            <Mail className="w-8 h-8 text-blue-300" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg border border-emerald-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-emerald-600 mb-1">Sent</p>
              <p className="text-2xl font-bold text-emerald-900">{guests.filter((g) => g.invite_sent).length}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-emerald-300" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg border border-amber-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-amber-600 mb-1">Not Sent</p>
              <p className="text-2xl font-bold text-amber-900">{notSentCount}</p>
            </div>
            <Loader className="w-8 h-8 text-amber-300" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-purple-600 mb-1">Contactable</p>
              <p className="text-2xl font-bold text-purple-900">{unsentWithContact.length}</p>
            </div>
            <Send className="w-8 h-8 text-purple-300" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        {renderSectionTitle(<Send className="w-5 h-5" />, "Messaging & Communication")}

        <div className="space-y-3">
          <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Select Delivery Channels</label>
          <div className="flex flex-wrap gap-3">
            {CHANNEL_OPTIONS.map((opt) => {
              const active = channels.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setChannels(channels.includes(opt.value) ? channels.filter((c) => c !== opt.value) : [...channels, opt.value])}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    active
                      ? "bg-slate-900 text-white border-slate-900 shadow-md"
                      : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
                  }`}
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                    active ? "border-white bg-white" : "border-slate-400"
                  }`}>
                    {active && <div className="w-2 h-2 rounded-sm bg-slate-900" />}
                  </div>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {messageEditor}

        {guestCountRange && channels.length > 0 && totalPrice > 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Cost Estimate</h3>
            <div className="space-y-2 text-sm">
              {channels.map((ch) => {
                const price = PRICE_TABLE[guestCountRange]?.[ch] || 0;
                return (
                  <div key={ch} className="flex items-center justify-between text-slate-700">
                    <span className="capitalize">{ch}</span>
                    <span>NGN {price.toLocaleString()}</span>
                  </div>
                );
              })}
              <div className="flex items-center justify-between font-semibold text-slate-900 pt-2 border-t border-slate-200">
                <span>Total ({guestCountRange} guests)</span>
                <span>NGN {totalPrice.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 flex gap-3">
          <Lightbulb className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-900">
            Sends to eligible guests through all selected channels. Guests must have the required contact info (email for email, phone for WhatsApp/SMS).
          </p>
        </div>

        {invalidPhoneGuests.length > 0 && phoneSelected && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-900">
              <span className="font-semibold">{invalidPhoneGuests.length} guest{invalidPhoneGuests.length === 1 ? "" : "s"} have invalid phone numbers</span> and cannot receive WhatsApp/SMS invites. Fix these on the Guests tab before sending.
            </p>
          </div>
        )}

        {guestsWithMissingContact.length > 0 && invalidPhoneGuests.length === 0 && (
          <div className="rounded-lg border border-slate-300 bg-slate-100 p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-700">
              <span className="font-semibold">{guestsWithMissingContact.length} guest{guestsWithMissingContact.length === 1 ? "" : "s"}</span> missing required contact info will be skipped.
              {!emailSelected && " Email deselected."}
              {!phoneSelected && " Phone channels deselected."}
            </p>
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide block mb-3">Target Audience</label>
          <div className="flex flex-wrap gap-2">
            {[
              { value: "all", label: `All (${guests.length})` },
              { value: "accepted", label: `Accepted (${acceptedCount})` },
              { value: "pending", label: `Pending (${pendingCount})` },
              { value: "declined", label: `Declined (${declinedCount})` },
              { value: "not_sent", label: `Not Sent (${notSentCount})` },
              { value: "no_contact", label: `No Contact (${noContactCount})` },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTargetFilter(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  targetFilter === opt.value
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {targetFilter === "no_contact"
              ? "Guests missing required contact info for selected channels"
              : targetFilter !== "all"
                ? `${matchedGuests.length} guest(s) match this filter`
                : `Sending to all ${guests.length} guest(s)`}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap pt-2">
          <Button
            onClick={sendBatchInvites}
            disabled={batchSending || batchSize === 0}
            className="bg-slate-900 hover:bg-slate-800 text-white h-10 font-medium gap-2"
            title={batchSize === 0 ? "All guests have been sent invites" : `Send to ${batchSize} unsent guest(s)`}
          >
            {batchSending ? (
              <><Loader className="w-4 h-4 animate-spin" /> Sending...</>
            ) : (
              <><Send className="w-4 h-4" /> Send Invites ({batchSize})</>
            )}
          </Button>
          {batchResult && !batchResult.error && remainingAfterBatch > 0 && !batchSending && (
            <Button
              onClick={sendBatchInvites}
              variant="outline"
              className="h-10 font-medium text-primary border-primary"
            >
              Send Next Batch ({Math.min(5, remainingAfterBatch)})
            </Button>
          )}
          <Button
            onClick={() => setShowResendModal(true)}
            disabled={resendSending}
            variant="outline"
            className="h-10 font-medium"
          >
            {resendSending ? <><Loader className="w-4 h-4 animate-spin" /> Resending...</> : "Resend All"}
          </Button>
          <Button
            onClick={sendAllQrs}
            disabled={sending}
            variant="outline"
            className="h-10 font-medium"
            title="Send QR codes to all guests"
          >
            {sending ? <><Loader className="w-4 h-4 animate-spin" /> Sending...</> : "Send QR"}
          </Button>
          <Button
            variant="outline"
            onClick={handleTestSend}
            disabled={testLoading}
            className="h-10 font-medium"
          >
            {testLoading ? <><Loader className="w-4 h-4 animate-spin" /> Testing...</> : "Test Send"}
          </Button>
        </div>

        {testResult && (
          <div className={`rounded-lg border p-4 flex gap-3 ${testResult.includes("failed") || testResult.includes("error") ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
            {testResult.includes("failed") || testResult.includes("error") ? <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" /> : <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />}
            <div className="flex-1">
              <p className="text-sm font-medium">{testResult}</p>
              <button onClick={() => setTestResult(null)} className="text-xs underline mt-1 opacity-70">Dismiss</button>
            </div>
          </div>
        )}

        {batchResult && (
          <div className={`rounded-lg border p-4 flex gap-3 ${batchResult.error ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
            {batchResult.error ? <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" /> : <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />}
            <div>
              {batchResult.error ? (
                <p className="text-sm text-red-700">{batchResult.error}</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-emerald-900">
                    Sent to {batchResult.sent} of {batchResult.total} guest(s)
                  </p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    {batchResult.batchGuests && <>Guests: {batchResult.batchGuests} &middot; </>}
                    {batchResult.remaining > 0 ? `${batchResult.remaining} guest(s) remaining` : "All contactable guests have been invited!"}
                  </p>
                </>
              )}
              <button onClick={() => setBatchResult(null)} className="text-xs underline mt-1 opacity-70">Dismiss</button>
            </div>
          </div>
        )}

        {sendResult && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 flex gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-emerald-900">
              <p className="font-semibold">Success!</p>
              {sendResult.channels ? (
                <ul className="mt-1 space-y-1">
                  {Object.entries(sendResult.channels).map(([ch, info]: [string, any]) => (
                    <li key={ch}>{ch}: {info.sent}/{info.total} sent{info.skipped_max_attempts > 0 ? ` (${info.skipped_max_attempts} skipped)` : ""}</li>
                  ))}
                </ul>
              ) : (
                <p>Sent {sendResult.total_sent ?? 0} of {sendResult.total_guests ?? 0}</p>
              )}
            </div>
          </div>
        )}

        {sendError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-900 whitespace-pre-line">{sendError}</p>
          </div>
        )}

        {resendResult && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 flex gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-emerald-900">
              <p className="font-semibold">Resend complete!</p>
              {resendResult.channels ? (
                <ul className="mt-1 space-y-1">
                  {Object.entries(resendResult.channels).map(([ch, info]: [string, any]) => (
                    <li key={ch}>{ch}: {info.sent}/{info.total} sent</li>
                  ))}
                </ul>
              ) : (
                <p>Sent {resendResult.total_sent ?? 0} of {resendResult.total_guests ?? 0}</p>
              )}
            </div>
          </div>
        )}

        {resendError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-900">{resendError}</p>
          </div>
        )}
      </div>

      {logs.length > 0 && (
        <div>
          <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Delivery History
          </h2>
          <div className="space-y-2">
            {logs.map((log: any) => (
              <div key={log.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-medium text-slate-900 truncate">{log.guest_name || `Guest #${log.guest_id}`}</span>
                  <span className="text-xs text-slate-400 capitalize whitespace-nowrap">{log.channel || "—"}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-xs font-medium ${log.status === "delivered" || log.status === "sent" ? "text-emerald-600" : log.status === "failed" ? "text-red-600" : "text-slate-400"}`}>
                    {log.status || "pending"}
                  </span>
                  {log.sent_at && <span className="text-xs text-slate-400 whitespace-nowrap">{new Date(log.sent_at).toLocaleString()}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Download className="w-5 h-5" />
          Export Messages
        </h2>
        <div className="flex gap-2 flex-wrap">
          <select
            value={exportMsgStatus}
            onChange={(e) => setExportMsgStatus?.(e.target.value)}
            className="flex h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="all">All Statuses</option>
            <option value="sent">Sent</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
            <option value="read">Read</option>
            <option value="queued">Queued</option>
          </select>
          <select
            value={exportMsgChannel}
            onChange={(e) => setExportMsgChannel?.(e.target.value)}
            className="flex h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="all">All Channels</option>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">SMS</option>
          </select>
          <Button
            onClick={exportMessages}
            disabled={exportingMsg}
            className="h-10 px-4 font-medium bg-slate-900 hover:bg-slate-800 text-white"
          >
            {exportingMsg ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exportingMsg ? "Exporting..." : "Export CSV"}
          </Button>
        </div>
      </div>

      {showResendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowResendModal(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Resend Invites?</h3>
            <p className="text-sm text-slate-600 mb-4">
              This will resend invites to <strong>all {guests.length} guests</strong>, including those who have already received them.
              {guests.filter((g) => g.invite_sent).length > 0 && (
                <> <strong>{guests.filter((g) => g.invite_sent).length} guest(s)</strong> have already been sent invites and will receive duplicates.</>
              )}
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowResendModal(false)} className="h-10">Cancel</Button>
              <Button onClick={handleResendAll} disabled={resendSending} className="h-10 bg-slate-900 hover:bg-slate-800 text-white">
                {resendSending ? "Resending..." : "Yes, Resend All"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
