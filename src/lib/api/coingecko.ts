import type { PriceData, HistoricalPrice } from "@/types/portfolio";

const CG_BASE = "https://api.coingecko.com/api/v3";

function getApiKeyParam(): string {
  const key = process.env.COINGECKO_API_KEY;
  if (key) return `&x_cg_demo_api_key=${key}`;
  return "";
}

export async function fetchCoinGeckoPrice(
  coinId: string,
  ticker: string
): Promise<PriceData> {
  const res = await fetch(
    `${CG_BASE}/simple/price?ids=${coinId}&vs_currencies=usd,brl&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true${getApiKeyParam()}`,
    { next: { revalidate: 300 } }
  );

  if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);

  const data = await res.json();
  const coin = data[coinId];
  if (!coin) throw new Error(`No CoinGecko data for ${coinId}`);

  return {
    ticker,
    currentPrice: coin.usd,
    openPrice: null,
    highPrice: null,
    lowPrice: null,
    previousClose: null,
    changePercent: coin.usd_24h_change,
    volume: coin.usd_24h_vol,
    marketCap: coin.usd_market_cap,
    currency: "USD",
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchCoinGeckoHistory(
  coinId: string,
  days: number | string
): Promise<HistoricalPrice[]> {
  const res = await fetch(
    `${CG_BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}${getApiKeyParam()}`
  );

  if (!res.ok) throw new Error(`CoinGecko history error: ${res.status}`);

  const data = await res.json();
  const prices: [number, number][] = data.prices || [];

  return prices.map(([timestamp, price]) => ({
    date: new Date(timestamp).toISOString().split("T")[0],
    open: null,
    high: null,
    low: null,
    close: price,
    volume: null,
  }));
}
