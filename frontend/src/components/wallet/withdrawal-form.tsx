"use client";

import { useState } from "react";
import { AlertCircle, Send, Info, CheckCircle2, Clock, DollarSign, Shield } from "lucide-react";
import { SUPPORTED_CURRENCIES, formatCurrencyAmount } from "@/lib/currencies";
import { getCountryFlag } from "@/lib/country-flag";

interface WithdrawalFormProps {
  wallets: Array<{ currency: string; balance: number }>;
  bankAccounts: Array<{ id: number; bank_name: string; currency: string; country_code: string; masked_account: string }>;
  onSubmit: (accountId: number, amount: number) => Promise<void>;
  loading?: boolean;
}

export function WithdrawalForm({
  wallets,
  bankAccounts,
  onSubmit,
  loading = false,
}: WithdrawalFormProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const formatCommas = (v: string) => {
    const cleaned = v.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
    const parts = cleaned.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  };
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const selectedAccount = bankAccounts.find((a) => a.id === selectedAccountId);
  const selectedWallet = selectedAccount
    ? wallets.find((w) => w.currency === selectedAccount.currency)
    : null;
  const selectedCurrency = SUPPORTED_CURRENCIES.find((c) => c.code === selectedAccount?.currency);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedAccountId) {
      setError("Please select a bank account");
      return;
    }

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (!selectedWallet || selectedWallet.balance < numAmount) {
      setError("Insufficient balance");
      return;
    }

    if (selectedCurrency && numAmount < selectedCurrency.min_fund) {
      setError(`Minimum withdrawal is ${formatCurrencyAmount(selectedCurrency.min_fund, selectedCurrency.code)}`);
      return;
    }

    if (!agreedToTerms) {
      setError("Please agree to the terms and conditions");
      return;
    }

    // Show confirmation dialog
    setShowConfirm(true);
  };

  const handleConfirmedSubmit = async () => {
    try {
      const numAmount = parseFloat(amount);
      await onSubmit(selectedAccountId!, numAmount);
      setSuccess("Withdrawal request submitted successfully!");
      setAmount("");
      setDescription("");
      setSelectedAccountId(null);
      setShowConfirm(false);
      setAgreedToTerms(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process withdrawal");
      setShowConfirm(false);
    }
  };

  const dailyLimit = selectedCurrency?.daily_withdrawal_limit || 0;
  const verificationThreshold = selectedCurrency?.verification_threshold || 0;
  const willRequireVerification = parseFloat(amount) > verificationThreshold;

  const [showDetails, setShowDetails] = useState(false);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-xl border border-[#fecdd3] bg-[#fef2f2] p-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-[#dc2626] flex-shrink-0 mt-0.5" />
            <p className="text-sm font-semibold text-[#991b1b]">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-[#dcfce7] bg-[#f0fdf4] p-4">
          <div className="flex gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-semibold text-[#166534]">{success}</p>
          </div>
        </div>
      )}

      {/* Bank Account Selection */}
      <div>
        <label className="block text-sm font-semibold text-[#0D1B2A] mb-2">Withdraw To</label>
        <select
          value={selectedAccountId || ""}
          onChange={(e) => setSelectedAccountId(parseInt(e.target.value) || null)}
          disabled={loading || bankAccounts.length === 0}
          className="w-full h-12 rounded-xl border border-[#d9e2ec] px-3 text-sm outline-none focus:border-[#1ABC9C] focus:ring-1 focus:ring-[#1ABC9C] disabled:bg-[#f8fafc] disabled:opacity-50"
        >
          <option value="">Select a bank account...</option>
          {bankAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {getCountryFlag(account.country_code)} {account.bank_name} • {account.masked_account} ({account.currency})
            </option>
          ))}
        </select>
        {bankAccounts.length === 0 && (
          <p className="text-xs text-[#1ABC9C] mt-1">Add a bank account first</p>
        )}
      </div>

      {/* Amount */}
      {selectedWallet && (
        <div>
          <label className="block text-sm font-semibold text-[#0D1B2A] mb-2">Amount</label>
          <div className="space-y-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base font-bold text-[#0D1B2A]">
                {selectedCurrency?.symbol}
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={formatCommas(amount)}
                onChange={(e) => setAmount(e.target.value.replace(/,/g, ""))}
                disabled={loading}
                placeholder="0.00"
                className="w-full h-12 rounded-xl border border-[#d9e2ec] px-3 pl-10 text-base font-semibold outline-none focus:border-[#1ABC9C] focus:ring-1 focus:ring-[#1ABC9C] disabled:bg-[#f8fafc]"
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-[#64748b]">
                Available: {formatCurrencyAmount(selectedWallet.balance, selectedWallet.currency)}
              </p>
              <button
                type="button"
                onClick={() => setAmount(selectedWallet.balance.toString())}
                className="text-xs font-semibold text-[#1ABC9C] hover:underline"
              >
                Use Max
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Description */}
      <div>
        <label className="block text-sm font-semibold text-[#0D1B2A] mb-2">Description (Optional)</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={loading}
          placeholder="e.g., For project fees"
          maxLength={100}
          className="w-full h-12 rounded-xl border border-[#d9e2ec] px-3 text-sm outline-none focus:border-[#1ABC9C] focus:ring-1 focus:ring-[#1ABC9C] disabled:bg-[#f8fafc]"
        />
      </div>

      {/* Summary Card */}
      {selectedCurrency && amount && selectedWallet && (
        <div className="rounded-xl border border-[#e8edf2] bg-gradient-to-br from-[#1ABC9C]/5 to-[#1ABC9C]/10 p-4 sm:p-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#64748b]">Amount</p>
              <p className="text-lg font-bold text-[#0D1B2A]">{formatCurrencyAmount(parseFloat(amount) || 0, selectedCurrency.code)}</p>
            </div>

            <div className="flex items-center justify-between pb-3 border-b border-[#1ABC9C]/20">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-[#1ABC9C]" />
                <p className="text-sm text-[#64748b]">Fee</p>
              </div>
              <p className="font-semibold text-[#1ABC9C]">{selectedCurrency.symbol}50.00</p>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[#0D1B2A]">You'll Receive</p>
              <p className="text-lg font-bold text-emerald-600">{formatCurrencyAmount((parseFloat(amount) || 0) - 50, selectedCurrency.code)}</p>
            </div>
          </div>

          {/* Expandable Details */}
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="w-full mt-4 pt-3 border-t border-[#1ABC9C]/20 text-xs font-semibold text-[#1ABC9C] hover:text-[#16A085] transition-colors text-center"
          >
            {showDetails ? "Hide Details" : "Show Details"}
          </button>
        </div>
      )}

      {/* Expanded Details Section */}
      {showDetails && selectedCurrency && amount && (
        <div className="space-y-2 rounded-lg border border-[#e8edf2] bg-[#f8f9fc] p-4 sm:p-5">
          <div className="flex gap-2 pb-3 border-b border-[#e8edf2]">
            <Clock className="h-4 w-4 text-[#0D1B2A] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-[#0D1B2A]">Processing Time</p>
              <p className="text-xs text-[#64748b]">1-3 business days</p>
            </div>
          </div>

          <div className="flex gap-2 pb-3 border-b border-[#e8edf2]">
            <Info className="h-4 w-4 text-[#0D1B2A] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-[#0D1B2A]">Daily Limit</p>
              <p className="text-xs text-[#64748b]">{formatCurrencyAmount(selectedCurrency.daily_withdrawal_limit, selectedCurrency.code)}</p>
            </div>
          </div>

          {willRequireVerification && (
            <div className="flex gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-800">High Amount</p>
                <p className="text-xs text-amber-700">Amounts over {formatCurrencyAmount(selectedCurrency.verification_threshold, selectedCurrency.code)} may require additional verification</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Account Verification Status */}
      {selectedAccount && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 flex gap-2">
          <Shield className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-700">
            <span className="font-semibold">Account verified</span>: You can withdraw to this account
          </p>
        </div>
      )}

      {/* Terms & Conditions */}
      <div className="flex gap-3 items-start border-t border-[#e8edf2] pt-4">
        <input
          type="checkbox"
          id="agree-terms"
          checked={agreedToTerms}
          onChange={(e) => setAgreedToTerms(e.target.checked)}
          className="w-4 h-4 mt-1 rounded border-[#d9e2ec] cursor-pointer"
        />
        <label htmlFor="agree-terms" className="text-xs text-[#64748b] cursor-pointer leading-relaxed">
          I understand that withdrawal fees apply and processing takes 1-3 business days. I confirm the bank account details are correct.
        </label>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading || !selectedAccountId || !selectedWallet || parseFloat(amount) <= 0 || !agreedToTerms}
        className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-[#1ABC9C] px-6 text-sm font-bold text-white hover:bg-[#16A085] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Send className="h-4 w-4" />
        {loading ? "Processing..." : "Request Withdrawal"}
      </button>

      {/* Confirmation Dialog */}
      {showConfirm && selectedAccount && selectedCurrency && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-md mx-4">
            <h2 className="text-xl font-bold text-[#0D1B2A] mb-4">Confirm Withdrawal</h2>

            <div className="space-y-4 mb-6">
              <div className="flex justify-between items-center pb-3 border-b border-[#e8edf2]">
                <p className="text-sm text-[#64748b]">Bank Account</p>
                <p className="font-semibold text-[#0D1B2A]">{selectedAccount.bank_name}</p>
              </div>

              <div className="flex justify-between items-center pb-3 border-b border-[#e8edf2]">
                <p className="text-sm text-[#64748b]">Amount</p>
                <p className="font-bold text-[#0D1B2A]">{formatCurrencyAmount(parseFloat(amount) || 0, selectedCurrency.code)}</p>
              </div>

              <div className="flex justify-between items-center pb-3 border-b border-[#e8edf2]">
                <p className="text-sm text-[#64748b]">Fee</p>
                <p className="font-semibold text-[#1ABC9C]">{selectedCurrency.symbol}50.00</p>
              </div>

              <div className="flex justify-between items-center">
                <p className="text-sm font-semibold text-[#0D1B2A]">You'll Receive</p>
                <p className="text-lg font-bold text-emerald-600">{formatCurrencyAmount((parseFloat(amount) || 0) - 50, selectedCurrency.code)}</p>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex gap-2">
                <Clock className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  This withdrawal will arrive in 1-3 business days
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-[#e8edf2] text-[#0D1B2A] font-semibold hover:bg-[#f8f9fc] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmedSubmit}
                disabled={loading}
                className="flex-1 px-4 py-2 rounded-lg bg-[#1ABC9C] text-white font-semibold hover:bg-[#16A085] disabled:opacity-50 transition-colors"
              >
                {loading ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
