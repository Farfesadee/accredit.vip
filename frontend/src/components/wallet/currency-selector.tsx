"use client";

import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { getCountryFlag } from "@/lib/country-flag";

interface CurrencySelectorProps {
  onSelect: (currency: string) => void;
  selectedCurrency?: string;
}

export function CurrencySelector({ onSelect, selectedCurrency }: CurrencySelectorProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-[#0D1B2A] mb-4">Select Currency</h3>
        <p className="text-sm text-[#64748b] mb-6">Choose a currency to fund your wallet</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {SUPPORTED_CURRENCIES.map((currency) => (
          <button
            key={currency.code}
            onClick={() => onSelect(currency.code)}
            className={`rounded-xl p-4 text-left transition-all border-2 ${
              selectedCurrency === currency.code
                ? "border-[#1ABC9C] bg-[#fff1f8]"
                : "border-[#e8edf2] bg-white hover:border-[#1ABC9C]/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f0f4f8] text-xl">
                  {getCountryFlag(currency.flag)}
                </div>
                <div>
                  <p className="font-bold text-[#0D1B2A]">{currency.code}</p>
                  <p className="text-xs text-[#64748b]">{currency.country}</p>
                </div>
              </div>
              {selectedCurrency === currency.code && (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1ABC9C]">
                  <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-[#94a3b8]">Min: {currency.symbol}{currency.min_fund.toLocaleString()}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
