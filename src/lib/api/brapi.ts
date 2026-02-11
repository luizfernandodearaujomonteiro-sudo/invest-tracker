import type { PriceData, HistoricalPrice } from "@/types/portfolio";

const BRAPI_BASE = "https://brapi.dev/api";

export async function fetchBrapiQuote(ticker: string): Promise<PriceData> {
  const token = process.env.BRAPI_TOKEN;
  const url = `${BRAPI_BASE}/quote/${ticker}${token ? `?token=${token}` : ""}`;

  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`brapi error: ${res.status}`);

  const data = await res.json();
  const result = data.results?.[0];
  if (!result) throw new Error(`No data for ${ticker}`);

  return {
    ticker: result.symbol,
    currentPrice: result.regularMarketPrice,
    openPrice: result.regularMarketOpen,
    highPrice: result.regularMarketDayHigh,
    lowPrice: result.regularMarketDayLow,
    previousClose: result.regularMarketPreviousClose,
    changePercent: result.regularMarketChangePercent,
    volume: result.regularMarketVolume,
    marketCap: result.marketCap,
    currency: "BRL",
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchBrapiHistory(
  ticker: string,
  range: string
): Promise<HistoricalPrice[]> {
  const token = process.env.BRAPI_TOKEN;
  const url = `${BRAPI_BASE}/quote/${ticker}?range=${range}&interval=1d${token ? `&token=${token}` : ""}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`brapi history error: ${res.status}`);

  const data = await res.json();
  const prices = data.results?.[0]?.historicalDataPrice || [];

  return prices.map(
    (p: { date: number; open: number; high: number; low: number; close: number; volume: number }) => ({
      date: new Date(p.date * 1000).toISOString().split("T")[0],
      open: p.open,
      high: p.high,
      low: p.low,
      close: p.close,
      volume: p.volume,
    })
  );
}
