"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { getCountryFlag } from "@/lib/country-flag";

const DEFAULT_CURRENCY = SUPPORTED_CURRENCIES[0]?.code || "NGN";

interface AddBankAccountFormProps {
  userFullName: string;
  onSubmit: (accountData: {
    account_holder_name: string;
    account_number: string;
    bank_name: string;
    bank_code: string;
    country_code: string;
    currency: string;
  }) => Promise<void>;
  loading?: boolean;
}

export function AddBankAccountForm({
  userFullName,
  onSubmit,
  loading = false,
}: AddBankAccountFormProps) {
  const [formData, setFormData] = useState({
    account_holder_name: "",
    account_number: "",
    bank_name: "",
    bank_code: "",
    country_code: "",
    currency: DEFAULT_CURRENCY,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState("");

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.account_holder_name.trim()) {
      newErrors.account_holder_name = "Account holder name is required";
    } else if (formData.account_holder_name.trim() !== userFullName.trim()) {
      newErrors.account_holder_name = `Must match your name: ${userFullName}`;
    }

    if (!formData.account_number.trim()) {
      newErrors.account_number = "Account number is required";
    } else if (formData.account_number.length < 8 || formData.account_number.length > 20) {
      newErrors.account_number = "Account number must be 8-20 characters";
    }

    if (!formData.bank_name.trim()) {
      newErrors.bank_name = "Bank name is required";
    }

    if (!formData.bank_code.trim()) {
      newErrors.bank_code = "Bank code is required";
    }

    if (!formData.country_code) {
      newErrors.country_code = "Country is required";
    }

    if (!formData.currency) {
      newErrors.currency = "Currency is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess("");

    if (!validate()) {
      return;
    }

    try {
      await onSubmit(formData);
      setSuccess("Bank account added successfully!");
      setFormData({
        account_holder_name: "",
        account_number: "",
        bank_name: "",
        bank_code: "",
        country_code: "",
        currency: DEFAULT_CURRENCY,
      });
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setErrors({
        submit: err instanceof Error ? err.message : "Failed to add bank account",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {success && (
        <div className="rounded-xl border border-[#dcfce7] bg-[#f0fdf4] p-4">
          <div className="flex gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-semibold text-emerald-700">{success}</p>
          </div>
        </div>
      )}

      {errors.submit && (
        <div className="rounded-xl border border-[#fecdd3] bg-[#fef2f2] p-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-[#dc2626] flex-shrink-0 mt-0.5" />
            <p className="text-sm font-semibold text-[#991b1b]">{errors.submit}</p>
          </div>
        </div>
      )}

      {/* Account Holder Name */}
      <div className="rounded-lg border border-[#e8edf2] bg-[#f8f9fc] p-4 sm:p-5">
        <p className="text-xs font-bold text-[#0D1B2A] uppercase tracking-widest mb-3">Account Holder</p>
        <label htmlFor="account_holder_name" className="block text-sm font-semibold text-[#0D1B2A] mb-2">
          Name
        </label>
        <input
          type="text"
          id="account_holder_name"
          name="account_holder_name"
          value={formData.account_holder_name}
          onChange={handleInputChange}
          disabled={loading}
          placeholder={userFullName}
          className={`w-full h-12 rounded-xl border px-3 text-sm outline-none focus:border-[#1ABC9C] focus:ring-1 focus:ring-[#1ABC9C] disabled:bg-white disabled:opacity-50 ${
            errors.account_holder_name ? "border-[#dc2626]" : "border-[#d9e2ec]"
          }`}
        />
        {errors.account_holder_name && (
          <p className="text-xs text-[#dc2626] mt-2">{errors.account_holder_name}</p>
        )}
        {!errors.account_holder_name && (
          <p className="text-xs text-[#64748b] mt-2">Must match your registered name exactly</p>
        )}
      </div>

      {/* Bank Details Group */}
      <div className="rounded-lg border border-[#e8edf2] bg-[#f8f9fc] p-4 sm:p-5">
        <p className="text-xs font-bold text-[#0D1B2A] uppercase tracking-widest mb-4">Bank Details</p>
        <div className="space-y-4">
          {/* Account Number */}
          <div>
            <label htmlFor="account_number" className="block text-sm font-semibold text-[#0D1B2A] mb-2">
              Account Number
            </label>
            <input
              type="text"
              id="account_number"
              name="account_number"
              value={formData.account_number}
              onChange={handleInputChange}
              disabled={loading}
              placeholder="Enter account number"
              maxLength={20}
              className={`w-full h-12 rounded-xl border px-3 text-sm outline-none focus:border-[#1ABC9C] focus:ring-1 focus:ring-[#1ABC9C] disabled:bg-white disabled:opacity-50 ${
                errors.account_number ? "border-[#dc2626]" : "border-[#d9e2ec]"
              }`}
            />
            {errors.account_number && (
              <p className="text-xs text-[#dc2626] mt-1">{errors.account_number}</p>
            )}
          </div>

          {/* Bank Name */}
          <div>
            <label htmlFor="bank_name" className="block text-sm font-semibold text-[#0D1B2A] mb-2">
              Bank Name
            </label>
            <input
              type="text"
              id="bank_name"
              name="bank_name"
              value={formData.bank_name}
              onChange={handleInputChange}
              disabled={loading}
              placeholder="e.g., First Bank of Nigeria"
              className={`w-full h-12 rounded-xl border px-3 text-sm outline-none focus:border-[#1ABC9C] focus:ring-1 focus:ring-[#1ABC9C] disabled:bg-white disabled:opacity-50 ${
                errors.bank_name ? "border-[#dc2626]" : "border-[#d9e2ec]"
              }`}
            />
            {errors.bank_name && (
              <p className="text-xs text-[#dc2626] mt-1">{errors.bank_name}</p>
            )}
          </div>

          {/* Bank Code */}
          <div>
            <label htmlFor="bank_code" className="block text-sm font-semibold text-[#0D1B2A] mb-2">
              Bank Code
            </label>
            <input
              type="text"
              id="bank_code"
              name="bank_code"
              value={formData.bank_code}
              onChange={handleInputChange}
              disabled={loading}
              placeholder="e.g., 011"
              maxLength={10}
              className={`w-full h-12 rounded-xl border px-3 text-sm outline-none focus:border-[#1ABC9C] focus:ring-1 focus:ring-[#1ABC9C] disabled:bg-white disabled:opacity-50 ${
                errors.bank_code ? "border-[#dc2626]" : "border-[#d9e2ec]"
              }`}
            />
            {errors.bank_code && (
              <p className="text-xs text-[#dc2626] mt-1">{errors.bank_code}</p>
            )}
          </div>
        </div>
      </div>

      {/* Location & Currency Group */}
      <div className="rounded-lg border border-[#e8edf2] bg-[#f8f9fc] p-4 sm:p-5">
        <p className="text-xs font-bold text-[#0D1B2A] uppercase tracking-widest mb-4">Location & Currency</p>
        <div className="space-y-4">
          {/* Country Code */}
          <div>
            <label htmlFor="country_code" className="block text-sm font-semibold text-[#0D1B2A] mb-2">
              Country
            </label>
            <div className="relative">
              <select
                id="country_code"
                name="country_code"
                value={formData.country_code}
                onChange={handleInputChange}
                disabled={loading}
                className={`w-full h-12 rounded-xl border px-3 pl-11 text-sm outline-none focus:border-[#1ABC9C] focus:ring-1 focus:ring-[#1ABC9C] disabled:bg-white disabled:opacity-50 appearance-none ${
                  errors.country_code ? "border-[#dc2626]" : "border-[#d9e2ec]"
                }`}
              >
                <option value="">Select a country...</option>
                {SUPPORTED_CURRENCIES.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {getCountryFlag(currency.flag)} {currency.country} ({currency.code})
                  </option>
                ))}
              </select>
              {formData.country_code && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg pointer-events-none">
                  {getCountryFlag(formData.country_code)}
                </span>
              )}
            </div>
            {errors.country_code && (
              <p className="text-xs text-[#dc2626] mt-1">{errors.country_code}</p>
            )}
          </div>

          {/* Currency */}
          <div>
            <label htmlFor="currency" className="block text-sm font-semibold text-[#0D1B2A] mb-2">
              Currency
            </label>
            <select
              id="currency"
              name="currency"
              value={formData.currency}
              onChange={handleInputChange}
              disabled={loading}
              className={`w-full h-12 rounded-xl border px-3 text-sm outline-none focus:border-[#1ABC9C] focus:ring-1 focus:ring-[#1ABC9C] disabled:bg-white disabled:opacity-50 ${
                errors.currency ? "border-[#dc2626]" : "border-[#d9e2ec]"
              }`}
            >
              {SUPPORTED_CURRENCIES.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} - {currency.name}
                </option>
              ))}
            </select>
            {errors.currency && (
              <p className="text-xs text-[#dc2626] mt-1">{errors.currency}</p>
            )}
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full h-12 rounded-xl bg-[#1ABC9C] text-sm font-bold text-white hover:bg-[#16A085] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Adding Account..." : "Add Bank Account"}
      </button>

      <p className="text-xs text-[#64748b] text-center">
        🔒 Your account information is encrypted and secured
      </p>
    </form>
  );
}
