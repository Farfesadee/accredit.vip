"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader, X } from "lucide-react";

type SendMessageModalProps = {
  isOpen: boolean;
  onClose: () => void;
  guestName: string;
  messageType: "std" | "qr" | "invite";
  currentSendCount: number;
  onSend: () => Promise<void>;
  onResendAnyway: () => Promise<void>;
  isSending: boolean;
};

const messageTypeConfig = {
  std: {
    title: "Send Save the Date",
    description: "Send the Save the Date image",
  },
  qr: {
    title: "Send QR Code",
    description: "Send the QR access code",
  },
  invite: {
    title: "Send Invite",
    description: "Send event invitation",
  },
};

export function SendMessageModal({
  isOpen,
  onClose,
  guestName,
  messageType,
  currentSendCount,
  onSend,
  onResendAnyway,
  isSending,
}: SendMessageModalProps) {
  if (!isOpen) return null;

  const config = messageTypeConfig[messageType];
  const hasReachedLimit = currentSendCount >= 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">{config.title}</h2>
          <button
            onClick={onClose}
            disabled={isSending}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <p className="text-sm text-slate-600 mb-2">Recipient:</p>
            <p className="text-base font-semibold text-slate-900">{guestName}</p>
          </div>

          <div>
            <p className="text-sm text-slate-600 mb-2">Message Type:</p>
            <p className="text-base text-slate-900">{config.description}</p>
          </div>

          <div>
            <p className="text-sm text-slate-600 mb-2">Sends to this guest:</p>
            <p className="text-base font-semibold text-slate-900">
              {currentSendCount} of 3
            </p>
          </div>

          {hasReachedLimit && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-900">
                This guest has already received this message 3 times. Click "Resend Anyway" to send again.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-6 border-t border-slate-200">
          <Button
            onClick={onClose}
            disabled={isSending}
            variant="outline"
            className="flex-1"
          >
            Cancel
          </Button>
          {hasReachedLimit ? (
            <Button
              onClick={onResendAnyway}
              disabled={isSending}
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white gap-2"
            >
              {isSending ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Resend Anyway"
              )}
            </Button>
          ) : (
            <Button
              onClick={onSend}
              disabled={isSending}
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white gap-2"
            >
              {isSending ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
