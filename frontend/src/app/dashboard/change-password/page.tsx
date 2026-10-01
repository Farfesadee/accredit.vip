"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { apiClient } from "@/lib/api-client";

export default function ChangePasswordPage() {
  const { user, loading } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState({
    current: false,
    next: false,
    confirm: false,
  });

  if (loading || !user) return null;

  const togglePassword = (field: keyof typeof visiblePasswords) => {
    setVisiblePasswords((current) => ({ ...current, [field]: !current[field] }));
  };

  const PasswordInput = ({
    id,
    label,
    value,
    onChange,
    visible,
    onToggle,
  }: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    visible: boolean;
    onToggle: () => void;
  }) => (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 pr-11 text-sm"
          required
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute inset-y-0 right-3 flex items-center text-gray-400 transition-colors hover:text-[#1ABC9C]"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters");
      return;
    }
    setSubmitting(true);
    try {
      await apiClient("/auth/change-password", {
        method: "POST",
        body: { current_password: currentPassword, new_password: newPassword },
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password");
    }
    setSubmitting(false);
  };

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <CheckCircle2 className="mx-auto h-14 w-14 text-[#10b981]" />
          <h1 className="text-2xl font-semibold">Password Changed</h1>
          <p className="text-sm text-muted-foreground">Your password has been updated successfully.</p>
          <Link href="/dashboard"><Button className="w-full">Back to Dashboard</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-start px-4 py-2 sm:py-4">
      <div className="w-full max-w-sm space-y-0">
        <Link
          href="/dashboard"
          className="mb-3 inline-flex h-10 items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.18)] bg-[#0D1B2A] px-4 text-sm font-bold text-white shadow-md transition-all hover:bg-[#13283d] hover:border-[#1ABC9C]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back
        </Link>
        <div className="text-center pt-0">
          <Link href="/" className="inline-block mb-4">
            <Image
              src="/logo-mark.png"
              alt="Accredit Interactive"
              width={4071}
              height={761}
              className="h-8 w-auto object-contain"
            />
          </Link>
          <h1 className="text-2xl font-semibold">Change Password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Update your account password
          </p>
        </div>
        <form className="space-y-4 pt-1" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <PasswordInput id="current-password" label="Current Password" value={currentPassword} onChange={setCurrentPassword} visible={visiblePasswords.current} onToggle={() => togglePassword("current")} />
          <PasswordInput id="new-password" label="New Password" value={newPassword} onChange={setNewPassword} visible={visiblePasswords.next} onToggle={() => togglePassword("next")} />
          <PasswordInput id="confirm-password" label="Confirm New Password" value={confirmPassword} onChange={setConfirmPassword} visible={visiblePasswords.confirm} onToggle={() => togglePassword("confirm")} />
          <Button type="submit" className="h-14 w-full text-base font-bold" disabled={submitting}>
            {submitting ? "Changing..." : "Change Password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
