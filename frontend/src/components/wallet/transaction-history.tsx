"use client";

import { ArrowDownLeft, ArrowUpRight, Search, Filter, ChevronRight, Clock, CheckCircle2, XCircle, AlertCircle, Info } from "lucide-react";
import { useState, useMemo } from "react";
import { formatCurrencyAmount } from "@/lib/currencies";

interface Transaction {
  id: string;
  type: "deposit" | "withdrawal" | "transfer";
  amount: number;
  currency: string;
  status: "completed" | "pending" | "failed";
  date: string;
  description: string;
  reference: string;
  fee?: number;
  method?: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}

function formatLongDate(iso: string): string {
  const d = new Date(iso);
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const n = d.getDate();
  const ord = n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th";
  return `${days[d.getDay()]} ${n}${ord} ${months[d.getMonth()]}, ${d.getFullYear()}`;
}

function formatTime12h(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s} ${ampm}`;
}

const typeLabel: Record<string, string> = { deposit: "Deposit", withdrawal: "Withdrawal", transfer: "Transfer" };

interface TransactionHistoryProps {
  transactions?: Transaction[];
  loading?: boolean;
}

const statusConfig = {
  completed: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
  pending: { icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
  failed: { icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
};

const typeConfig = {
  deposit: { label: "Deposit", icon: ArrowDownLeft, color: "text-blue-600" },
  withdrawal: { label: "Withdrawal", icon: ArrowUpRight, color: "text-purple-600" },
  transfer: { label: "Transfer", icon: ChevronRight, color: "text-gray-600" },
};

function DetailRow({ label, value, bold, mono, last, valueClass }: { label: string; value: string; bold?: boolean; mono?: boolean; last?: boolean; valueClass?: string }) {
  return (
    <div className={`flex justify-between items-start gap-3 py-2 ${last ? "" : "border-b border-[#e8edf2]"}`}>
      <p className="text-sm text-[#64748b] shrink-0">{label}</p>
      <p className={`text-sm text-right break-words min-w-0 ${bold ? "font-bold text-[#0D1B2A]" : "font-medium text-[#0D1B2A]"} ${mono ? "font-mono text-xs" : ""} ${valueClass || ""}`}>{value}</p>
    </div>
  );
}

export function TransactionHistory({ transactions = [], loading = false }: TransactionHistoryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "deposit" | "withdrawal" | "transfer">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "completed" | "pending" | "failed">("all");
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [dateRange, setDateRange] = useState<"all" | "7days" | "30days" | "90days">("all");

  const displayTransactions = transactions;

  const getDateRangeFilter = (date: string) => {
    const txDate = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));

    switch (dateRange) {
      case "7days":
        return diffDays <= 7;
      case "30days":
        return diffDays <= 30;
      case "90days":
        return diffDays <= 90;
      default:
        return true;
    }
  };

  const filteredTransactions = useMemo(() => {
    return displayTransactions.filter((tx) => {
      const matchesSearch =
        tx.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.currency.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = filterType === "all" || tx.type === filterType;
      const matchesStatus = filterStatus === "all" || tx.status === filterStatus;
      const matchesDateRange = getDateRangeFilter(tx.date);

      return matchesSearch && matchesType && matchesStatus && matchesDateRange;
    });
  }, [displayTransactions, searchQuery, filterType, filterStatus, dateRange]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94a3b8]" />
          <input
            type="text"
            placeholder="Search by reference, description, or currency..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-[#e8edf2] focus:outline-none focus:border-[#1ABC9C] text-[#0D1B2A]"
          />
        </div>

        {/* Filter Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={() => setDateRange("all")}
              className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
                dateRange === "all"
                  ? "bg-[#1ABC9C] text-white"
                  : "bg-[#f0f1f7] text-[#64748b] hover:bg-[#e8edf2]"
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setDateRange("7days")}
              className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
                dateRange === "7days"
                  ? "bg-[#1ABC9C] text-white"
                  : "bg-[#f0f1f7] text-[#64748b] hover:bg-[#e8edf2]"
              }`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setDateRange("30days")}
              className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
                dateRange === "30days"
                  ? "bg-[#1ABC9C] text-white"
                  : "bg-[#f0f1f7] text-[#64748b] hover:bg-[#e8edf2]"
              }`}
            >
              Last 30 Days
            </button>
            <button
              onClick={() => setDateRange("90days")}
              className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
                dateRange === "90days"
                  ? "bg-[#1ABC9C] text-white"
                  : "bg-[#f0f1f7] text-[#64748b] hover:bg-[#e8edf2]"
              }`}
            >
              Last 90 Days
            </button>
        </div>

        {/* Type and Status Filters */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-[#0D1B2A] mb-2">Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full px-4 py-2 rounded-lg border border-[#e8edf2] focus:outline-none focus:border-[#1ABC9C] text-[#0D1B2A] bg-white"
            >
              <option value="all">All Types</option>
              <option value="deposit">Deposits</option>
              <option value="withdrawal">Withdrawals</option>
              <option value="transfer">Transfers</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#0D1B2A] mb-2">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full px-4 py-2 rounded-lg border border-[#e8edf2] focus:outline-none focus:border-[#1ABC9C] text-[#0D1B2A] bg-white"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transaction List */}
      {filteredTransactions.length === 0 ? (
        <div className="rounded-xl border border-[#e8edf2] bg-[#f8f9fc] p-12 text-center">
          <Filter className="mx-auto h-12 w-12 text-[#94a3b8] mb-3" />
          <p className="text-sm font-semibold text-[#0D1B2A]">No transactions yet</p>
          <p className="text-xs text-[#64748b] mt-1">Your wallet activity will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTransactions.map((tx) => {
            const TypeIcon = typeConfig[tx.type].icon;
            const StatusIcon = statusConfig[tx.status].icon;

            return (
              <button
                key={tx.id}
                onClick={() => setSelectedTransaction(tx)}
                className="w-full rounded-xl border border-[#e8edf2] bg-white p-4 hover:border-[#1ABC9C] hover:bg-[#fff1f8] transition-all text-left group"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                    <div className={`p-2.5 sm:p-3 rounded-lg shrink-0 ${typeConfig[tx.type].color.replace("text-", "bg-").replace("600", "50")}`}>
                      <TypeIcon className={`w-5 h-5 ${typeConfig[tx.type].color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#0D1B2A]">{typeConfig[tx.type].label}</p>
                      <p className="text-sm text-[#64748b] truncate">{tx.description}</p>
                      <p className="text-xs text-[#94a3b8] mt-1">{new Date(tx.date).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3 ml-2 sm:ml-4 shrink-0">
                    <div className="text-right">
                      <p className={`font-bold ${tx.type === "withdrawal" ? "text-red-600" : "text-green-600"}`}>
                        {tx.type === "withdrawal" ? "-" : "+"}{formatCurrencyAmount(tx.amount, tx.currency)}
                      </p>
                      <div className="flex items-center gap-1 justify-end mt-1">
                        <StatusIcon className={`w-4 h-4 ${statusConfig[tx.status].color}`} />
                        <p className={`text-xs font-semibold ${statusConfig[tx.status].color}`}>
                          {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-[#94a3b8] group-hover:text-[#1ABC9C] transition-colors" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedTransaction(null)}>
          <div
            className="bg-white rounded-xl p-5 sm:p-6 w-full max-w-md max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2.5 rounded-lg shrink-0 ${typeConfig[selectedTransaction.type].color.replace("text-", "bg-").replace("600", "50")}`}>
                {(() => {
                  const Icon = typeConfig[selectedTransaction.type].icon;
                  return <Icon className={`w-5 h-5 ${typeConfig[selectedTransaction.type].color}`} />;
                })()}
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-[#0D1B2A]">Transaction Receipt</h2>
                <p className={`font-bold ${selectedTransaction.type === "withdrawal" ? "text-red-600" : "text-green-600"}`}>
                  {selectedTransaction.type === "withdrawal" ? "-" : "+"}{formatCurrencyAmount(selectedTransaction.amount, selectedTransaction.currency)}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <DetailRow label="Amount" value={`${selectedTransaction.type === "withdrawal" ? "-" : "+"}${formatCurrencyAmount(selectedTransaction.amount, selectedTransaction.currency)}`} bold />
              {selectedTransaction.name && <DetailRow label="Name" value={selectedTransaction.name} />}
              {selectedTransaction.email && <DetailRow label="Email" value={selectedTransaction.email} />}
              {selectedTransaction.phone && <DetailRow label="Phone" value={selectedTransaction.phone} />}
              <DetailRow label="Transaction Type" value={typeLabel[selectedTransaction.type] || selectedTransaction.type} />
              <DetailRow
                label="Status"
                value={selectedTransaction.status.charAt(0).toUpperCase() + selectedTransaction.status.slice(1)}
                valueClass={statusConfig[selectedTransaction.status].color}
              />
              <DetailRow label="Date" value={formatLongDate(selectedTransaction.date)} />
              <DetailRow label="Time" value={formatTime12h(selectedTransaction.date)} />
              <DetailRow label="Reference" value={selectedTransaction.reference} mono last />
            </div>

            <button
              onClick={() => setSelectedTransaction(null)}
              className="w-full py-2.5 bg-[#1ABC9C] text-white font-bold rounded-lg hover:bg-[#16A085] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
