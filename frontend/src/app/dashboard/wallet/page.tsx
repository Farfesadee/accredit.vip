"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { WalletDashboard } from "@/components/wallet/wallet-dashboard";
import { BankAccountManager } from "@/components/wallet/bank-account-manager";
import { AddBankAccountForm } from "@/components/wallet/add-bank-account-form";
import { WithdrawalForm } from "@/components/wallet/withdrawal-form";
import { CurrencySelector } from "@/components/wallet/currency-selector";
import { TransactionHistory } from "@/components/wallet/transaction-history";
import { SUPPORTED_CURRENCIES, formatCurrencyAmount as formatAmount } from "@/lib/currencies";
import { Toast } from "@/components/shared/toast";
import { Menu, X, LayoutGrid, Calendar, Plus, Wallet as WalletIcon, Compass, LogOut, Lock, RefreshCw, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

interface Wallet {
  id: number;
  currency: string;
  balance: number;
  is_primary: boolean;
}



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

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visibleStart = local.slice(0, Math.min(8, local.length));
  const visibleEnd = local.length > 1 ? local.slice(-1) : "";
  return `${visibleStart}******${visibleEnd}@${domain}`;
}

export default function WalletPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const getTabFromUrl = () => {
    if (typeof window === "undefined") return "overview";
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab") as "overview" | "deposit" | "withdraw" | "accounts" | "history" | null;
    return tab || "overview";
  };
  const [activeTab, setActiveTab] = useState<"overview" | "deposit" | "withdraw" | "accounts" | "history">(getTabFromUrl);
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const formatCommas = (v: string) => {
    const cleaned = v.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
    const parts = cleaned.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  };
  const [depositError, setDepositError] = useState<string | null>(null);
  const [depositProvider, setDepositProvider] = useState("paystack");
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [toastVisible, setToastVisible] = useState(false);

  // Refresh after returning from a payment provider (redirect from wallet funding)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("reference");
    if (ref) {
      (async () => {
        await new Promise((r) => setTimeout(r, 2000));
        await fetchWallets();
        await fetchTransactions();
        window.history.replaceState({}, "", "/dashboard/wallet?tab=history");
        setActiveTab("history");
      })();
    }
  }, []);

  // Wait for auth to initialize before checking user
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    fetchWallets();
    fetchBankAccounts();
    fetchTransactions();
  }, [user, authLoading, router]);

  const fetchWallets = async () => {
    try {
      const res = await fetch("/api/v1/wallets");
      if (res.ok) {
        const data = await res.json();
        setWallets(Array.isArray(data) ? data : data.wallets || []);
      }
    } catch (err) {}
  };

  const fetchBankAccounts = async () => {
    try {
      const res = await fetch("/api/v1/bank-accounts");
      if (res.ok) {
        const data = await res.json();
        setBankAccounts(Array.isArray(data) ? data : data.accounts || []);
      }
    } catch (err) {}
  };

  const fetchTransactions = async () => {
    try {
      const res = await fetch("/api/v1/wallet");
      if (!res.ok) return;
      const data = await res.json();
      if (!data || !Array.isArray(data.transactions)) return;
      setTransactions(
        data.transactions.map((tx: any) => {
          if (!tx || typeof tx !== "object") return null;
          return {
            id: String(tx.id ?? ""),
            type: tx.type === "credit" ? "deposit" : tx.type === "debit" ? "withdrawal" : ["deposit", "withdrawal", "transfer"].includes(tx.type) ? tx.type : "deposit",
            amount: Number(tx.amount) || 0,
            currency: String(tx.currency ?? "NGN"),
            status: ["completed", "pending", "failed"].includes(tx.status) ? tx.status : "pending",
            date: tx.created_at || new Date().toISOString(),
            description: String(tx.description || `Deposit via ${tx.provider || "Wallet"}`),
            reference: String(tx.reference ?? ""),
            name: tx.buyer_name || null,
            email: tx.buyer_email || null,
            phone: tx.buyer_phone || null,
          };
        }).filter(Boolean)
      );
    } catch (err) {}
  };

  const handleAddBankAccount = async (accountData: any) => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/bank-accounts/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accountData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Failed to add bank account");
      }

      await fetchBankAccounts();
      switchTab("overview");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBankAccount = async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/bank-accounts/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete bank account");
      }

      await fetchBankAccounts();
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (tab: "overview" | "deposit" | "withdraw" | "accounts" | "history") => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
  };

  const handleDepositCurrency = async (currency: string) => {
    if (!currency) {
      switchTab("deposit");
      setSelectedCurrency("");
    } else {
      setSelectedCurrency(currency);
      switchTab("deposit");
    }
  };

  const handleWithdrawCurrency = async (currency: string) => {
    setSelectedCurrency(currency);
    switchTab("withdraw");
  };

  const handleCurrencySelect = async (currency: string) => {
    if (activeTab === "deposit") {
      setSelectedCurrency(currency);
      setDepositAmount("");
      setDepositError(null);
    } else {
      setSelectedCurrency(currency);
      setLoading(true);
      try {
        const res = await fetch("/api/v1/wallets/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currency }),
        });

        if (res.ok) {
          await fetchWallets();
          switchTab("overview");
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const handleWithdrawalSubmit = async (accountId: number, amount: number) => {
    setLoading(true);
    try {
      const account = bankAccounts.find((a) => a.id === accountId);
      const currency = account?.currency || selectedCurrency;
      const res = await fetch("/api/v1/withdrawals/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bank_account_id: accountId,
          amount,
          currency,
        }),
      });

      if (!res.ok) {
        let msg = "Something went wrong. Please try again.";
        try {
          const error = await res.json();
          msg = error.detail || msg;
        } catch (_) {}
        throw new Error(msg);
      }

      await fetchWallets();
      await fetchTransactions();
      showToast("Withdrawal request submitted successfully", "success");
      switchTab("history");
      setSelectedCurrency("");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9fc]">
        <div className="flex items-center gap-2 text-[#64748b]">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-[#f8f9fc]">
      {/* Mobile overlay */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMobileNavOpen(false)} />
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4">
            <h2 className="text-lg font-bold text-[#0D1B2A] mb-2">Sign Out?</h2>
            <p className="text-[#64748b] mb-6">Are you sure you want to sign out?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-[#e8edf2] text-[#0D1B2A] font-semibold hover:bg-[#f8f9fc] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar (same as before: keep unchanged) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex-col flex-shrink-0 transition-all duration-300 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 lg:static lg:flex`}
        style={{
          background: "#0D1B2A",
          width: sidebarOpen ? "256px" : "80px",
        }}
      >
        <div className="flex items-center justify-between h-24 px-4 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Link href="/" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
            <Image src="/logo-mark.png" alt="" width={366} height={372} className="h-10 w-auto object-contain flex-shrink-0" />
            {sidebarOpen && <Image src="/logo-text.png" alt="Accredit Interactive" width={594} height={152} className="h-8 w-auto object-contain min-w-0" />}
          </Link>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0 hidden lg:block ml-2"
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarOpen ? <X className="w-5 h-5 text-white/80" /> : <Menu className="w-5 h-5 text-white/80" />}
          </button>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {sidebarOpen && <p className="px-3 text-[10px] font-bold text-white/25 uppercase tracking-widest mb-3">Main Menu</p>}
          {[
            { href: "/dashboard", label: "Dashboard", icon: <LayoutGrid className="w-4 h-4" /> },
            { href: "/dashboard/events", label: "Events", icon: <Calendar className="w-4 h-4" /> },
            { href: "/dashboard/create", label: "Create Event", icon: <Plus className="w-4 h-4" /> },
            { href: "/dashboard/wallet", label: "Wallet", icon: <WalletIcon className="w-4 h-4" />, active: true },
            { href: "/dashboard/failed-messages", label: "Failed Messages", icon: <AlertTriangle className="w-4 h-4" /> },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileNavOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group"
              style={{
                background: item.active ? "rgba(26, 188, 156,0.15)" : "transparent",
                color: item.active ? "#1ABC9C" : "rgba(255,255,255,0.6)",
              }}
              title={!sidebarOpen ? item.label : ""}
            >
              <span className={item.active ? "text-[#1ABC9C]" : "text-white/40"}>{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </Link>
          ))}

          {sidebarOpen && (
            <div className="pt-4 mt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="px-3 text-[10px] font-bold text-white/25 uppercase tracking-widest mb-3">Discover</p>
              <Link
                href="/attend"
                onClick={() => setMobileNavOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/08 transition-all"
              >
                <Compass className="w-4 h-4" />
                Browse Events
              </Link>
            </div>
          )}
        </nav>

        <div className="px-3 py-4 flex-shrink-0 space-y-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ background: "linear-gradient(135deg, #1ABC9C, #16A085)" }}>
              {user.full_name?.charAt(0) || "U"}
            </div>
            {sidebarOpen && (
              <div className="min-w-0 flex-1">
                <p className="text-white text-xs font-semibold truncate">{user.full_name}</p>
                <p className="text-white/40 text-xs truncate" title={maskEmail(user.email)}>{maskEmail(user.email)}</p>
              </div>
            )}
          </div>

          {sidebarOpen && (
            <>
              <Link
                href="/dashboard/change-password"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#1ABC9C] bg-[#1ABC9C]/10 hover:bg-[#1ABC9C]/20 transition-all w-full"
              >
                <Lock className="w-4 h-4" />
                Change Password
              </Link>
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-50 border-2 border-red-200 text-red-600 hover:bg-red-100 hover:border-red-400 font-bold text-sm transition-all hover:shadow-lg active:scale-95"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex items-center justify-between px-6 flex-shrink-0" style={{ background: "white", borderBottom: "1px solid #e8edf2" }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileNavOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <Menu className="w-5 h-5 text-[#0D1B2A]" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-[#0D1B2A]">Wallet</h1>
              <p className="text-xs text-gray-400">Manage your funds and bank accounts</p>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 py-8">
          {/* Tabs */}
          <div className="flex gap-2 mb-8 border-b border-[#e8edf2] overflow-x-auto no-scrollbar">
            {["overview", "deposit", "withdraw", "accounts", "history"].map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab as any);
                  const url = new URL(window.location.href);
                  if (tab === "overview") url.searchParams.delete("tab");
                  else url.searchParams.set("tab", tab);
                  window.history.replaceState({}, "", url.toString());
                  if (tab !== "deposit" && tab !== "withdraw") setSelectedCurrency("");
                }}
                className={`px-4 py-3 font-semibold text-sm transition-all border-b-2 flex-shrink-0 whitespace-nowrap ${
                  activeTab === tab
                    ? "border-[#1ABC9C] text-[#1ABC9C]"
                    : "border-transparent text-[#64748b] hover:text-[#0D1B2A]"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          <div className="space-y-6">
            {activeTab === "overview" && (
              <>
                <WalletDashboard
                  wallets={wallets}
                  onDeposit={handleDepositCurrency}
                  onWithdraw={handleWithdrawCurrency}
                  loading={loading}
                />
                <BankAccountManager
                  accounts={bankAccounts}
                  onAdd={() => switchTab("accounts")}
                  onDelete={handleDeleteBankAccount}
                  loading={loading}
                />
              </>
            )}

            {activeTab === "deposit" && (
              <div className="bg-white rounded-xl border border-[#e8edf2] p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold text-[#0D1B2A] mb-6">Add Funds</h2>

                {!selectedCurrency ? (
                  <CurrencySelector
                    onSelect={handleCurrencySelect}
                    selectedCurrency={selectedCurrency}
                  />
                ) : (
                  <>
                    {depositError && (
                      <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-600 font-medium mb-2">Error</p>
                        <p className="text-sm text-red-500 mb-3">{depositError}</p>
                        <button
                          onClick={() => setDepositError(null)}
                          className="text-sm text-red-600 hover:text-red-700 font-semibold underline"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}

                    <div className="bg-gradient-to-br from-[#1ABC9C]/5 to-[#1ABC9C]/10 rounded-xl border border-[#1ABC9C]/20 p-4 mb-6">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <p className="text-xs text-[#64748b] uppercase tracking-wide font-semibold mb-1">Selected Currency</p>
                          <p className="text-2xl font-bold text-[#0D1B2A]">{selectedCurrency}</p>
                          <p className="text-xs text-[#64748b] mt-2">
                            {(() => {
                              const cur = SUPPORTED_CURRENCIES.find((c) => c.code === selectedCurrency);
                              return cur ? `Min deposit: ${formatAmount(cur.min_fund, cur.code)}` : "";
                            })()}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedCurrency("");
                            setDepositAmount("");
                            setDepositError(null);
                          }}
                          className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-[#1ABC9C] border border-[#1ABC9C] rounded-lg hover:bg-[#1ABC9C]/5 transition-colors"
                        >
                          Change currency
                        </button>
                      </div>
                    </div>

                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-[#0D1B2A] mb-2">Amount to Deposit</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-[#0D1B2A]">
                          {SUPPORTED_CURRENCIES.find((c) => c.code === selectedCurrency)?.symbol}
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={formatCommas(depositAmount)}
                          onChange={(e) => setDepositAmount(e.target.value.replace(/,/g, ""))}
                          placeholder="0.00"
                          className="w-full h-12 rounded-lg border border-[#d9e2ec] px-3 pl-10 text-base font-semibold outline-none focus:border-[#1ABC9C] focus:ring-1 focus:ring-[#1ABC9C]"
                        />
                      </div>
                    </div>

                    <div className="mb-8">
                      <p className="text-xs font-semibold text-[#0D1B2A] uppercase tracking-widest mb-3">Choose Payment Method</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { value: "paystack", label: "Paystack" },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setDepositProvider(opt.value)}
                            className={`h-14 rounded-lg font-semibold text-base transition-all border-2 ${
                              depositProvider === opt.value
                                ? "bg-[#0D1B2A] text-white border-[#0D1B2A] shadow-md"
                                : "bg-white text-[#0D1B2A] border-[#d9e2ec] hover:border-[#1ABC9C] hover:bg-[#1ABC9C]/5"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={async () => {
                          setDepositError(null);
                          const amount = parseFloat(depositAmount);
                          const cur = SUPPORTED_CURRENCIES.find((c) => c.code === selectedCurrency);
                          if (!amount || amount <= 0) { setDepositError("Enter a valid amount"); return; }
                          if (cur && amount < cur.min_fund) {
                            setDepositError(`Minimum deposit is ${formatAmount(cur.min_fund, cur.code)}`);
                            return;
                          }
                          setLoading(true);
                          try {
                            const res = await fetch("/api/v1/wallet/fund", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ currency: selectedCurrency, amount, provider: depositProvider }),
                            });
                            if (!res.ok) {
                              const err = await res.json();
                              throw new Error(err.detail || "Failed to initiate deposit");
                            }
                            const data = await res.json();
                            if (data.authorization_url) {
                              window.location.href = data.authorization_url;
                            } else {
                              throw new Error("No payment URL returned");
                            }
                          } catch (err) {
                            setDepositError(
                              err instanceof Error ? err.message : "Network error. Check your connection and try again."
                            );
                          } finally {
                            setLoading(false);
                          }
                        }}
                        disabled={loading || !depositAmount || parseFloat(depositAmount) <= 0}
                        className="sm:flex-1 bg-[#1ABC9C] text-white font-bold py-3 px-4 rounded-lg hover:bg-[#16A085] disabled:opacity-50 disabled:cursor-not-allowed transition-colors h-12"
                      >
                        {loading ? "Processing..." : `Deposit ${selectedCurrency}`}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedCurrency("");
                          setDepositAmount("");
                          setDepositError(null);
                        }}
                        className="sm:flex-1 px-4 py-3 border-2 border-[#e8edf2] text-[#64748b] font-semibold rounded-lg hover:bg-[#f8f9fc] transition-colors h-12"
                      >
                        Back
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === "withdraw" && (
              <div className="bg-white rounded-xl border border-[#e8edf2] p-6">
                <h2 className="text-xl font-bold text-[#0D1B2A] mb-6">Request Withdrawal</h2>
                {bankAccounts.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-[#64748b] mb-4">Add a bank account first to withdraw funds</p>
                    <button
                      onClick={() => switchTab("accounts")}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#1ABC9C] px-4 py-2 text-sm font-bold text-white hover:bg-[#16A085] transition-colors"
                    >
                      Add Bank Account
                    </button>
                  </div>
                ) : (
                  <WithdrawalForm
                    wallets={wallets}
                    bankAccounts={bankAccounts}
                    onSubmit={handleWithdrawalSubmit}
                    loading={loading}
                  />
                )}
              </div>
            )}

            {activeTab === "accounts" && (
              <div className="bg-white rounded-xl border border-[#e8edf2] p-6">
                <h2 className="text-xl font-bold text-[#0D1B2A] mb-6">Add Bank Account</h2>
                {user && (
                  <AddBankAccountForm
                    userFullName={user.full_name}
                    onSubmit={handleAddBankAccount}
                    loading={loading}
                  />
                )}
              </div>
            )}

            {activeTab === "history" && (
              <div className="bg-white rounded-xl border border-[#e8edf2] p-6">
                <h2 className="text-xl font-bold text-[#0D1B2A] mb-6">Transaction History</h2>
                <TransactionHistory transactions={transactions} loading={loading} />
              </div>
            )}
          </div>
        </main>
      </div>
      <Toast message={toastMessage} type={toastType} visible={toastVisible} onClose={() => setToastVisible(false)} />
    </div>
  );
}