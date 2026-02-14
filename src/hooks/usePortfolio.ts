"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { PortfolioAsset, PortfolioSummary, CurrencySummaries } from "@/types/portfolio";
import type { AssetType, Currency } from "@/types/database";

interface HoldingRow {
  id: string;
  total_quantity: number;
  average_price: number;
  total_invested: number;
  fixed_income_rate: number | null;
  fixed_income_index: string | null;
  maturity_date: string | null;
  price_adjustments: Array<{
    date: string;
    oldPrice: number;
    newPrice: number;
    oldTotalInvested: number;
    newTotalInvested: number;
    note?: string;
  }> | null;
  broker_id: string;
  invest_brokers: { name: string };
  asset_id: string;
  invest_assets: {
    id: string;
    ticker: string;
    name: string;
    asset_type: AssetType;
    currency: Currency;
    logo_url: string | null;
  };
}

export function usePortfolio() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["portfolio"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Nao autenticado");

      const { data: holdings, error } = await supabase
        .from("invest_holdings")
        .select(
          `
          id,
          total_quantity,
          average_price,
          total_invested,
          fixed_income_rate,
          fixed_income_index,
          maturity_date,
          price_adjustments,
          broker_id,
          invest_brokers ( name ),
          asset_id,
          invest_assets ( id, ticker, name, asset_type, currency, logo_url )
        `
        )
        .gt("total_quantity", 0);

      if (error) throw error;

      // Fetch prices via API (populates cache and returns fresh data)
      const nonFixedTickers = (holdings as unknown as HoldingRow[])
        .filter((h) => h.invest_assets.asset_type !== "fixed_income")
        .map((h) => h.invest_assets.ticker);

      const tickerPriceMap = new Map<string, { currentPrice: number; changePercent: number | null }>();

      if (nonFixedTickers.length > 0) {
        try {
          const res = await fetch(`/api/prices?tickers=${nonFixedTickers.join(",")}`);
          if (res.ok) {
            const priceData = await res.json();
            for (const [ticker, data] of Object.entries(priceData)) {
              const d = data as { currentPrice: number; changePercent: number | null };
              tickerPriceMap.set(ticker, d);
            }
          }
        } catch (e) {
          console.error("Erro ao buscar precos:", e);
        }
      }

      const portfolioAssets: PortfolioAsset[] = (
        holdings as unknown as HoldingRow[]
      ).map((h) => {
        const price = tickerPriceMap.get(h.invest_assets.ticker);
        const currentPrice = price?.currentPrice ?? null;
        const currentValue =
          currentPrice !== null
            ? currentPrice * Number(h.total_quantity)
            : null;
        const profitLoss =
          currentValue !== null
            ? currentValue - Number(h.total_invested)
            : null;
        const profitLossPercent =
          profitLoss !== null && Number(h.total_invested) > 0
            ? (profitLoss / Number(h.total_invested)) * 100
            : null;

        return {
          holdingId: h.id,
          assetId: h.invest_assets.id,
          ticker: h.invest_assets.ticker,
          name: h.invest_assets.name,
          assetType: h.invest_assets.asset_type,
          currency: h.invest_assets.currency,
          brokerName: h.invest_brokers.name,
          brokerId: h.broker_id,
          totalQuantity: Number(h.total_quantity),
          averagePrice: Number(h.average_price),
          totalInvested: Number(h.total_invested),
          currentPrice,
          changePercent: price?.changePercent ?? null,
          currentValue,
          profitLoss,
          profitLossPercent,
          logoUrl: h.invest_assets.logo_url,
          priceAdjustments: h.price_adjustments || [],
          fixedIncomeIndex: h.fixed_income_index,
          fixedIncomeRate: h.fixed_income_rate ? Number(h.fixed_income_rate) : null,
          maturityDate: h.maturity_date,
        };
      });

      // Buscar valores de renda fixa para holdings sem preco
      const fixedIncomeHoldings = portfolioAssets.filter(
        (a) => a.assetType === "fixed_income" && a.currentValue === null
      );

      if (fixedIncomeHoldings.length > 0) {
        const holdingIds = fixedIncomeHoldings.map((a) => a.holdingId).join(",");
        try {
          const res = await fetch(`/api/fixed-income?holdings=${holdingIds}`);
          if (res.ok) {
            const { results } = await res.json();
            for (const asset of portfolioAssets) {
              const fi = results[asset.holdingId];
              if (fi) {
                asset.currentValue = fi.netValue;
                asset.currentPrice = fi.netValue;
                asset.profitLoss = fi.netValue - asset.totalInvested;
                asset.profitLossPercent = fi.netReturn;
              }
            }
          }
        } catch (e) {
          console.error("Erro ao buscar valores de renda fixa:", e);
        }
      }

      return portfolioAssets;
    },
  });
}

export function usePortfolioSummary(assets: PortfolioAsset[] | undefined) {
  if (!assets || assets.length === 0) {
    return {
      totalValue: 0,
      totalInvested: 0,
      totalProfitLoss: 0,
      totalProfitLossPercent: 0,
      dayChange: 0,
      dayChangePercent: 0,
      assetCount: 0,
    } as PortfolioSummary;
  }

  const totalInvested = assets.reduce((acc, a) => acc + a.totalInvested, 0);
  const totalValue = assets.reduce(
    (acc, a) => acc + (a.currentValue ?? a.totalInvested),
    0
  );
  const totalProfitLoss = totalValue - totalInvested;
  const totalProfitLossPercent =
    totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;

  const dayChange = assets.reduce((acc, a) => {
    if (a.currentValue && a.changePercent) {
      const prevValue = a.currentValue / (1 + a.changePercent / 100);
      return acc + (a.currentValue - prevValue);
    }
    return acc;
  }, 0);

  const dayChangePercent =
    totalValue > 0 ? (dayChange / (totalValue - dayChange)) * 100 : 0;

  return {
    totalValue,
    totalInvested,
    totalProfitLoss,
    totalProfitLossPercent,
    dayChange,
    dayChangePercent,
    assetCount: assets.length,
  } as PortfolioSummary;
}

function calcSummary(assets: PortfolioAsset[], currency: Currency): PortfolioSummary {
  const empty: PortfolioSummary = {
    totalValue: 0, totalInvested: 0, totalProfitLoss: 0,
    totalProfitLossPercent: 0, dayChange: 0, dayChangePercent: 0,
    assetCount: 0, currency,
  };
  if (assets.length === 0) return empty;

  const totalInvested = assets.reduce((acc, a) => acc + a.totalInvested, 0);
  const totalValue = assets.reduce((acc, a) => acc + (a.currentValue ?? a.totalInvested), 0);
  const totalProfitLoss = totalValue - totalInvested;
  const totalProfitLossPercent = totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;

  const dayChange = assets.reduce((acc, a) => {
    if (a.currentValue && a.changePercent) {
      const prevValue = a.currentValue / (1 + a.changePercent / 100);
      return acc + (a.currentValue - prevValue);
    }
    return acc;
  }, 0);
  const dayChangePercent = totalValue > 0 ? (dayChange / (totalValue - dayChange)) * 100 : 0;

  return {
    totalValue, totalInvested, totalProfitLoss, totalProfitLossPercent,
    dayChange, dayChangePercent, assetCount: assets.length, currency,
  };
}

export function usePortfolioSummaryByCurrency(assets: PortfolioAsset[] | undefined): CurrencySummaries {
  const brlAssets = (assets || []).filter((a) => a.currency === "BRL");
  const usdAssets = (assets || []).filter((a) => a.currency === "USD");

  return {
    brl: calcSummary(brlAssets, "BRL"),
    usd: calcSummary(usdAssets, "USD"),
  };
}
