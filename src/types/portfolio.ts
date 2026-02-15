import type { AssetType, Currency, PriceAdjustment, ManualOverrides } from "./database";

export interface PortfolioAsset {
  holdingId: string;
  assetId: string;
  ticker: string;
  name: string;
  assetType: AssetType;
  currency: Currency;
  brokerName: string;
  brokerId: string;
  totalQuantity: number;
  averagePrice: number;
  totalInvested: number;
  currentPrice: number | null;
  changePercent: number | null;
  currentValue: number | null;
  profitLoss: number | null;
  profitLossPercent: number | null;
  logoUrl: string | null;
  priceAdjustments: PriceAdjustment[];
  dividendsAccumulated: number;
  manualOverrides: ManualOverrides | null;
  // Renda fixa (opcional)
  fixedIncomeIndex?: string | null;
  fixedIncomeRate?: number | null;
  maturityDate?: string | null;
}

export interface PortfolioSummary {
  totalValue: number;
  totalInvested: number;
  totalProfitLoss: number;
  totalProfitLossPercent: number;
  dayChange: number;
  dayChangePercent: number;
  assetCount: number;
  currency?: Currency;
}

export interface CurrencySummaries {
  brl: PortfolioSummary;
  usd: PortfolioSummary;
}

export interface AllocationItem {
  label: string;
  value: number;
  percent: number;
  color: string;
}

export interface PriceData {
  ticker: string;
  currentPrice: number;
  openPrice: number | null;
  highPrice: number | null;
  lowPrice: number | null;
  previousClose: number | null;
  changePercent: number | null;
  volume: number | null;
  marketCap: number | null;
  currency: Currency;
  fetchedAt: string;
}

export interface HistoricalPrice {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
}

export type DateRange = "1D" | "1W" | "1M" | "3M" | "1Y" | "5Y" | "MAX";
