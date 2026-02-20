import type { PriceData, HistoricalPrice } from "@/types/portfolio";

const FINNHUB_BASE = "https://finnhub.io/api/v1";

function getKey(): string {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error("FINNHUB_API_KEY not configured");
  return key;
}

/**
 * Fetch real-time quote for a US stock/ETF via Finnhub.
 * Free tier: 60 calls/minute.
 */
export async function fetchFinnhubQuote(ticker: string): Promise<PriceData> {
  const key = getKey();
  const res = await fetch(
    `${FINNHUB_BASE}/quote?symbol=${ticker}&token=${key}`,
    { next: { revalidate: 60 } }
  );

  if (!res.ok) throw new Error(`Finnhub error: ${res.status}`);

  const data = await res.json();

  // Finnhub returns: c=current, o=open, h=high, l=low, pc=previous close, dp=change%, t=timestamp
  if (!data.c || data.c === 0) {
    throw new Error(`No Finnhub data for ${ticker}`);
  }

  return {
    ticker,
    currentPrice: data.c,
    openPrice: data.o || null,
    highPrice: data.h || null,
    lowPrice: data.l || null,
    previousClose: data.pc || null,
    changePercent: data.dp || null,
    volume: null,
    marketCap: null,
    currency: "USD",
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Fetch historical candles for a US stock/ETF via Finnhub.
 * Resolution: D (daily). Free tier supports daily candles.
 */
export async function fetchFinnhubHistory(
  ticker: string,
  days: number
): Promise<HistoricalPrice[]> {
  const key = getKey();
  const now = Math.floor(Date.now() / 1000);
  const from = now - days * 24 * 60 * 60;

  const res = await fetch(
    `${FINNHUB_BASE}/stock/candle?symbol=${ticker}&resolution=D&from=${from}&to=${now}&token=${key}`
  );

  if (!res.ok) throw new Error(`Finnhub history error: ${res.status}`);

  const data = await res.json();

  if (data.s !== "ok" || !data.c) {
    return [];
  }

  // data.t=timestamps, data.o=open, data.h=high, data.l=low, data.c=close, data.v=volume
  const results: HistoricalPrice[] = [];
  for (let i = 0; i < data.t.length; i++) {
    const date = new Date(data.t[i] * 1000).toISOString().split("T")[0];
    results.push({
      date,
      open: data.o[i],
      high: data.h[i],
      low: data.l[i],
      close: data.c[i],
      volume: data.v[i],
    });
  }

  return results;
}
