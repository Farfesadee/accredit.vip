// Supported currencies with metadata and AML limits
// Flag is a country code (2-letter ISO code) to be displayed as an icon
export const SUPPORTED_CURRENCIES = [
  {
    code: "NGN",
    name: "Nigerian Naira",
    flag: "NG",
    symbol: "₦",
    country: "Nigeria",
    min_fund: 100,
    daily_withdrawal_limit: 5000000,
    verification_threshold: 2000000,
  },
  {
    code: "USD",
    name: "US Dollar",
    flag: "US",
    symbol: "$",
    country: "United States",
    min_fund: 1,
    daily_withdrawal_limit: 50000,
    verification_threshold: 20000,
  },
  {
    code: "GBP",
    name: "British Pound",
    flag: "GB",
    symbol: "£",
    country: "United Kingdom",
    min_fund: 1,
    daily_withdrawal_limit: 40000,
    verification_threshold: 15000,
  },
  {
    code: "EUR",
    name: "Euro",
    flag: "EU",
    symbol: "€",
    country: "European Union",
    min_fund: 1,
    daily_withdrawal_limit: 40000,
    verification_threshold: 15000,
  },
  {
    code: "KES",
    name: "Kenyan Shilling",
    flag: "KE",
    symbol: "KSh",
    country: "Kenya",
    min_fund: 100,
    daily_withdrawal_limit: 5000000,
    verification_threshold: 2000000,
  },
  {
    code: "GHS",
    name: "Ghanaian Cedi",
    flag: "GH",
    symbol: "GH₵",
    country: "Ghana",
    min_fund: 5,
    daily_withdrawal_limit: 500000,
    verification_threshold: 100000,
  },
  {
    code: "ZAR",
    name: "South African Rand",
    flag: "ZA",
    symbol: "R",
    country: "South Africa",
    min_fund: 10,
    daily_withdrawal_limit: 1000000,
    verification_threshold: 500000,
  },
  {
    code: "RWF",
    name: "Rwandan Franc",
    flag: "RW",
    symbol: "FRw",
    country: "Rwanda",
    min_fund: 500,
    daily_withdrawal_limit: 100000000,
    verification_threshold: 50000000,
  },
  {
    code: "UGX",
    name: "Ugandan Shilling",
    flag: "UG",
    symbol: "USh",
    country: "Uganda",
    min_fund: 2000,
    daily_withdrawal_limit: 100000000,
    verification_threshold: 50000000,
  },
  {
    code: "TZS",
    name: "Tanzanian Shilling",
    flag: "TZ",
    symbol: "TSh",
    country: "Tanzania",
    min_fund: 1000,
    daily_withdrawal_limit: 500000000,
    verification_threshold: 100000000,
  },
  {
    code: "XOF",
    name: "CFA Franc",
    flag: "CI",
    symbol: "CFA",
    country: "West African States",
    min_fund: 500,
    daily_withdrawal_limit: 10000000,
    verification_threshold: 5000000,
  },
];

export const getCurrencyByCode = (code: string) => {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code);
};

export const formatCurrencyAmount = (amount: number, code: string) => {
  const currency = getCurrencyByCode(code);
  if (!currency) return `${amount} ${code}`;
  return `${currency.symbol}${amount.toLocaleString()}`;
};
