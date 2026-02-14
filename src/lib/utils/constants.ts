import type { AssetType } from "@/types/database";

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  br_stock: "Acao BR",
  br_fii: "FII",
  br_bdr: "BDR",
  br_etf: "ETF BR",
  us_stock: "Acao US",
  us_etf: "ETF US",
  crypto: "Cripto",
  fixed_income: "Renda Fixa",
};

export const ASSET_TYPE_COLORS: Record<AssetType, string> = {
  br_stock: "#2563eb",
  br_fii: "#7c3aed",
  br_bdr: "#0891b2",
  br_etf: "#059669",
  us_stock: "#dc2626",
  us_etf: "#ea580c",
  crypto: "#f59e0b",
  fixed_income: "#64748b",
};

export const BROKER_SUGGESTIONS = [
  { name: "XP Investimentos", type: "broker" as const },
  { name: "Clear Corretora", type: "broker" as const },
  { name: "Rico Investimentos", type: "broker" as const },
  { name: "Nomad", type: "broker" as const },
  { name: "Inter Invest", type: "broker" as const },
  { name: "Nubank", type: "broker" as const },
  { name: "BTG Pactual", type: "broker" as const },
  { name: "Binance", type: "exchange" as const },
  { name: "Mercado Bitcoin", type: "exchange" as const },
  { name: "Coinbase", type: "exchange" as const },
  { name: "Ledger", type: "wallet" as const },
  { name: "MetaMask", type: "wallet" as const },
  { name: "Trezor", type: "wallet" as const },
];

export const DATE_RANGE_OPTIONS = [
  { value: "1D" as const, label: "1D" },
  { value: "1W" as const, label: "1S" },
  { value: "1M" as const, label: "1M" },
  { value: "3M" as const, label: "3M" },
  { value: "1Y" as const, label: "1A" },
  { value: "5Y" as const, label: "5A" },
  { value: "MAX" as const, label: "Max" },
];

export const FIXED_INCOME_INDEX_LABELS: Record<string, string> = {
  cdi: "CDI",
  ipca: "IPCA+",
  selic: "Selic",
  prefixado: "Prefixado",
};

export const CHAIN_OPTIONS = [
  { value: "arbitrum" as const, label: "Arbitrum (ETH)" },
  { value: "bsc" as const, label: "BNB Chain" },
  { value: "bitcoin" as const, label: "Bitcoin" },
  { value: "solana" as const, label: "Solana" },
  { value: "xrpl" as const, label: "XRP Ledger" },
];

export const CACHE_TTL = {
  MARKET_OPEN: 5 * 60 * 1000,   // 5 minutes
  MARKET_CLOSED: 60 * 60 * 1000, // 1 hour
  HISTORY: 24 * 60 * 60 * 1000,  // 24 hours
  FIXED_INCOME: 60 * 60 * 1000,  // 1 hour
};
