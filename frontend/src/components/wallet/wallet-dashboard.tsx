"use client";

import { CreditCard, ArrowDownLeft, ArrowUpRight, Plus } from "lucide-react";
import { SUPPORTED_CURRENCIES, formatCurrencyAmount } from "@/lib/currencies";
import { getCountryFlag } from "@/lib/country-flag";

interface Wallet {
  id: number;
  currency: string;
  balance: number;
  is_primary: boolean;
}

interface WalletDashboardProps {
  wallets: Wallet[];
  onDeposit: (currency: string) => void;
  onWithdraw: (currency: string) => void;
  loading?: boolean;
}

export function WalletDashboard({
  wallets,
  onDeposit,
  onWithdraw,
  loading = false,
}: WalletDashboardProps) {
  const totalBalanceUSD = wallets.reduce((sum, wallet) => {
    const currency = SUPPORTED_CURRENCIES.find((c) => c.code === wallet.currency);
    return sum + wallet.balance;
  }, 0);

  return (
    <div className="space-y-6">
      {/* Total Balance Card */}
      <div className="rounded-xl bg-gradient-to-br from-[#1ABC9C] to-[#16A085] p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold opacity-90">Total Balance</p>
          <CreditCard className="h-5 w-5" />
        </div>
        <div>
          <p className="text-3xl font-bold mb-1">
            {wallets.length > 0 ? `${wallets.length} Wallet${wallets.length !== 1 ? "s" : ""}` : "No Wallets"}
          </p>
          <p className="text-sm opacity-90">{wallets.length > 0 ? "Active currencies" : "Start by adding funds"}</p>
        </div>
      </div>

      {/* Wallets Grid */}
      {wallets.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-[#e8edf2] bg-[#f8f9fc] p-8 text-center">
          <CreditCard className="mx-auto h-12 w-12 text-[#94a3b8] mb-3" />
          <p className="text-sm font-semibold text-[#0D1B2A]">No wallets yet</p>
          <p className="text-xs text-[#64748b] mt-1 mb-4">Create your first wallet by adding funds</p>
          <button
            onClick={() => onDeposit("")}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1ABC9C] px-4 py-2 text-sm font-bold text-white hover:bg-[#16A085] disabled:opacity-50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Funds
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {wallets.map((wallet) => {
            const currency = SUPPORTED_CURRENCIES.find((c) => c.code === wallet.currency);
            if (!currency) return null;

            return (
              <div
                key={wallet.id}
                className="rounded-xl border border-[#e8edf2] bg-white p-5 flex flex-col"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#f0f4f8] text-2xl">
                      {getCountryFlag(currency.flag)}
                    </div>
                    <div>
                      <p className="font-bold text-[#0D1B2A]">{currency.code}</p>
                      <p className="text-xs text-[#64748b]">{currency.name}</p>
                    </div>
                  </div>
                  {wallet.is_primary && (
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                      Primary
                    </span>
                  )}
                </div>

                {/* Balance */}
                <div className="mb-4 pb-4 border-b border-[#e8edf2]">
                  <p className="text-xs text-[#64748b] mb-1">Balance</p>
                  <p className="text-2xl font-bold text-[#0D1B2A]">
                    {formatCurrencyAmount(wallet.balance, wallet.currency)}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => onDeposit(wallet.currency)}
                    disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-[#1ABC9C] bg-white px-3 py-2 text-sm font-semibold text-[#1ABC9C] hover:bg-[#fff1f8] disabled:opacity-50 transition-colors"
                  >
                    <ArrowDownLeft className="h-4 w-4" />
                    Deposit
                  </button>
                  <button
                    onClick={() => onWithdraw(wallet.currency)}
                    disabled={loading || wallet.balance === 0}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#1ABC9C] px-3 py-2 text-sm font-semibold text-white hover:bg-[#16A085] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                    Withdraw
                  </button>
                </div>

                {/* Min Balance Info */}
                <p className="text-xs text-[#94a3b8] text-center mt-3">
                  Min deposit: {currency.symbol}{currency.min_fund.toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Wallet CTA */}
      {wallets.length > 0 && wallets.length < SUPPORTED_CURRENCIES.length && (
        <button
          onClick={() => onDeposit("")}
          disabled={loading}
          className="w-full rounded-xl border-2 border-dashed border-[#e8edf2] bg-[#f8f9fc] px-4 py-6 text-center hover:border-[#1ABC9C] hover:bg-[#fff1f8] transition-all disabled:opacity-50"
        >
          <div className="flex justify-center mb-2">
            <Plus className="h-6 w-6 text-[#1ABC9C]" />
          </div>
          <p className="text-sm font-bold text-[#0D1B2A]">Add Another Currency</p>
          <p className="text-xs text-[#64748b] mt-1">
            {SUPPORTED_CURRENCIES.length - wallets.length} more available
          </p>
        </button>
      )}
    </div>
  );
}
