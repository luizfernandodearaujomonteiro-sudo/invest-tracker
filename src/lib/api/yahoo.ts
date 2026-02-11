import type { PriceData, HistoricalPrice } from "@/types/portfolio";

const ALPHA_VANTAGE_BASE = "https://www.alphavantage.co/query";

export async function fetchAlphaVantageQuote(
  ticker: string
): Promise<PriceData> {
  const key = process.env.ALPHA_VANTAGE_KEY;
  if (!key) throw new Error("ALPHA_VANTAGE_KEY not configured");

  const res = await fetch(
    `${ALPHA_VANTAGE_BASE}?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${key}`,
    { next: { revalidate: 300 } }
  );

  if (!res.ok) throw new Error(`AlphaVantage error: ${res.status}`);

  const data = await res.json();
  const quote = data["Global Quote"];

  if (!quote || !quote["05. price"]) {
    throw new Error(`No AlphaVantage data for ${ticker}`);
  }

  const currentPrice = parseFloat(quote["05. price"]);
  const previousClose = parseFloat(quote["08. previous close"]);
  const changePercent = parseFloat(
    (quote["10. change percent"] || "0").replace("%", "")
  );

  return {
    ticker,
    currentPrice,
    openPrice: parseFloat(quote["02. open"]),
    highPrice: parseFloat(quote["03. high"]),
    lowPrice: parseFloat(quote["04. low"]),
    previousClose,
    changePercent,
    volume: parseInt(quote["06. volume"]),
    marketCap: null,
    currency: "USD",
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchAlphaVantageHistory(
  ticker: string,
  outputSize: "compact" | "full" = "compact"
): Promise<HistoricalPrice[]> {
  const key = process.env.ALPHA_VANTAGE_KEY;
  if (!key) throw new Error("ALPHA_VANTAGE_KEY not configured");

  const res = await fetch(
    `${ALPHA_VANTAGE_BASE}?function=TIME_SERIES_DAILY&symbol=${ticker}&outputsize=${outputSize}&apikey=${key}`
  );

  if (!res.ok) throw new Error(`AlphaVantage history error: ${res.status}`);

  const data = await res.json();
  const timeSeries = data["Time Series (Daily)"] || {};

  return Object.entries(timeSeries)
    .map(([date, values]: [string, unknown]) => {
      const v = values as Record<string, string>;
      return {
        date,
        open: parseFloat(v["1. open"]),
        high: parseFloat(v["2. high"]),
        low: parseFloat(v["3. low"]),
        close: parseFloat(v["4. close"]),
        volume: parseInt(v["5. volume"]),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
