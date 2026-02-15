import type { AssetType } from "@/types/database";
import type { PriceData, HistoricalPrice } from "@/types/portfolio";

const BRAPI_BASE = "https://brapi.dev/api";

/**
 * Detecta o asset_type correto de um ativo BR baseado no nome oficial retornado pela brapi.
 * Retorna null se nao conseguir determinar.
 */
export function detectBrAssetType(longName: string | undefined, ticker: string): AssetType | null {
  if (!longName) return null;

  const name = longName.toUpperCase();

  // ETF: "Fundo de Índice" ou contém "ETF"
  if (name.includes("FUNDO DE ÍNDICE") || name.includes("FUNDO DE INDICE") || name.includes(" ETF")) {
    return "br_etf";
  }

  // FII: "Fundo de Investimento Imobiliário" ou "FII"
  if (name.includes("FUNDO DE INVESTIMENTO IMOBILI") || name.includes(" FII")) {
    return "br_fii";
  }

  // BDR: sufixo 34/39/32 ou nome contém "BDR"
  if (/\d{2}$/.test(ticker) && /3[249]$/.test(ticker)) {
    return "br_bdr";
  }
  if (name.includes(" BDR") || name.includes("DEPOSITARY RECEIPT")) {
    return "br_bdr";
  }

  // Ação: sufixo 3,4,5,6 ou units (11) que não são FII/ETF
  if (/[3-6]$/.test(ticker) || ticker.endsWith("11")) {
    return "br_stock";
  }

  return null;
}

export async function fetchBrapiQuote(ticker: string): Promise<PriceData & { longName?: string }> {
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
    longName: result.longName || result.shortName,
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
