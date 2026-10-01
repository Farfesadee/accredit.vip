"use client";

import { useState } from "react";
import { Plus, Trash2, CheckCircle, AlertCircle, Landmark } from "lucide-react";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { getCountryFlag } from "@/lib/country-flag";

interface BankAccount {
  id: number;
  bank_name: string;
  country_code: string;
  currency: string;
  masked_account: string;
  is_verified: boolean;
  is_primary: boolean;
  created_at: string;
}

interface BankAccountManagerProps {
  accounts: BankAccount[];
  onAdd: () => void;
  onDelete: (id: number) => Promise<void>;
  loading?: boolean;
}

export function BankAccountManager({
  accounts,
  onAdd,
  onDelete,
  loading = false,
}: BankAccountManagerProps) {
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to remove this bank account?")) {
      setDeletingId(id);
      try {
        await onDelete(id);
      } finally {
        setDeletingId(null);
      }
    }
  };

  const getCurrencySymbol = (code: string) => {
    const curr = SUPPORTED_CURRENCIES.find((c) => c.code === code);
    return curr?.symbol || code;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-[#0D1B2A]">Bank Accounts</h3>
          <p className="text-sm text-[#64748b] mt-1">Manage withdrawal destinations</p>
        </div>
        <button
          onClick={onAdd}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-[#1ABC9C] px-4 py-2 text-sm font-bold text-white hover:bg-[#16A085] disabled:opacity-50 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Account
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-[#e8edf2] bg-[#f8f9fc] p-6 text-center">
          <Landmark className="mx-auto h-12 w-12 text-[#94a3b8] mb-3" />
          <p className="text-sm font-semibold text-[#0D1B2A]">No bank accounts added</p>
          <p className="text-xs text-[#64748b] mt-1">Add a bank account to start making withdrawals</p>
          <button
            onClick={onAdd}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#1ABC9C] px-4 py-2 text-sm font-bold text-white hover:bg-[#16A085] transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Your First Account
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="rounded-xl border border-[#e8edf2] bg-white p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f0f4f8]">
                  <Landmark className="h-5 w-5 text-[#0D1B2A]" />
                </div>
                <div>
                  <p className="font-bold text-[#0D1B2A]">{account.bank_name}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <p className="text-xs text-[#64748b]">{account.masked_account}</p>
                    <span className="text-xs font-semibold px-2 py-1 rounded bg-[#f0f4f8] text-[#0D1B2A]">
                      {account.currency}
                    </span>
                    <span className="text-xs font-semibold px-2 py-1 rounded bg-[#f0f4f8] text-[#0D1B2A] flex items-center gap-1">
                      {getCountryFlag(account.country_code)} {account.country_code}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  {account.is_verified ? (
                    <div className="flex items-center gap-1 text-xs text-emerald-600">
                      <CheckCircle className="h-4 w-4" />
                      <span>Verified</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-xs text-amber-600">
                      <AlertCircle className="h-4 w-4" />
                      <span>Pending</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(account.id)}
                  disabled={deletingId === account.id || loading}
                  className="p-2 text-[#94a3b8] hover:text-[#1ABC9C] hover:bg-[#fff1f8] rounded-lg transition-colors disabled:opacity-50"
                  title="Delete account"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
