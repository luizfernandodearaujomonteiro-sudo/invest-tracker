import type { AssetType } from "@/types/database";
import type { PriceData, HistoricalPrice, DateRange } from "@/types/portfolio";
import { fetchBrapiQuote, fetchBrapiHistory } from "./brapi";
import { fetchCoinGeckoPrice, fetchCoinGeckoHistory } from "./coingecko";
import { fetchFinnhubQuote, fetchFinnhubHistory } from "./finnhub";

export async function fetchPrice(
  ticker: string,
  assetType: AssetType,
  coingeckoId?: string | null
): Promise<PriceData> {
  switch (assetType) {
    case "br_stock":
    case "br_fii":
    case "br_bdr":
    case "br_etf":
      return fetchBrapiQuote(ticker);

    case "us_stock":
    case "us_etf":
      return fetchFinnhubQuote(ticker);

    case "crypto":
      if (!coingeckoId) throw new Error(`No CoinGecko ID for ${ticker}`);
      return fetchCoinGeckoPrice(coingeckoId, ticker);

    case "fixed_income":
      // Fixed income doesn't have real-time market prices
      throw new Error("Fixed income has no market price API");

    case "fund":
      // Funds use CVM data, fetched separately
      throw new Error("Fund prices fetched via CVM API");

    default:
      throw new Error(`Unknown asset type: ${assetType}`);
  }
}

const DATE_RANGE_BRAPI: Record<DateRange, string> = {
  "1D": "1d",
  "1W": "5d",
  "1M": "1mo",
  "3M": "3mo",
  "1Y": "1y",
  "5Y": "5y",
  MAX: "max",
};

const DATE_RANGE_CG_DAYS: Record<DateRange, number | string> = {
  "1D": 1,
  "1W": 7,
  "1M": 30,
  "3M": 90,
  "1Y": 365,
  "5Y": 1825,
  MAX: "max",
};

export async function fetchHistory(
  ticker: string,
  assetType: AssetType,
  range: DateRange,
  coingeckoId?: string | null
): Promise<HistoricalPrice[]> {
  switch (assetType) {
    case "br_stock":
    case "br_fii":
    case "br_bdr":
    case "br_etf":
      return fetchBrapiHistory(ticker, DATE_RANGE_BRAPI[range]);

    case "us_stock":
    case "us_etf": {
      const daysMap: Record<DateRange, number> = {
        "1D": 1,
        "1W": 7,
        "1M": 30,
        "3M": 90,
        "1Y": 365,
        "5Y": 1825,
        MAX: 9999,
      };
      return fetchFinnhubHistory(ticker, daysMap[range]);
    }

    case "crypto":
      if (!coingeckoId) throw new Error(`No CoinGecko ID for ${ticker}`);
      return fetchCoinGeckoHistory(coingeckoId, DATE_RANGE_CG_DAYS[range]);

    case "fixed_income":
    case "fund":
      return [];

    default:
      throw new Error(`Unknown asset type: ${assetType}`);
  }
}
