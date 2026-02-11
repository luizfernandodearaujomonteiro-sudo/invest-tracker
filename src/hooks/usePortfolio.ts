"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { PortfolioAsset, PortfolioSummary } from "@/types/portfolio";
import type { AssetType, Currency } from "@/types/database";

interface HoldingRow {
  id: string;
  total_quantity: number;
  average_price: number;
  total_invested: number;
  broker_id: string;
  brokers: { name: string };
  asset_id: string;
  assets: {
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
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Nao autenticado");

      const { data: holdings, error } = await supabase
        .from("holdings")
        .select(
          `
          id,
          total_quantity,
          average_price,
          total_invested,
          broker_id,
          brokers ( name ),
          asset_id,
          assets ( id, ticker, name, asset_type, currency, logo_url )
        `
        )
        .gt("total_quantity", 0);

      if (error) throw error;

      // Fetch prices for all assets
      const assetIds = (holdings as unknown as HoldingRow[]).map(
        (h) => h.assets.id
      );
      const { data: prices } = await supabase
        .from("price_cache")
        .select("asset_id, current_price, change_percent")
        .in("asset_id", assetIds);

      const priceMap = new Map(
        (prices || []).map((p) => [p.asset_id, p])
      );

      const portfolioAssets: PortfolioAsset[] = (
        holdings as unknown as HoldingRow[]
      ).map((h) => {
        const price = priceMap.get(h.assets.id);
        const currentPrice = price?.current_price
          ? Number(price.current_price)
          : null;
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
          assetId: h.assets.id,
          ticker: h.assets.ticker,
          name: h.assets.name,
          assetType: h.assets.asset_type,
          currency: h.assets.currency,
          brokerName: h.brokers.name,
          brokerId: h.broker_id,
          totalQuantity: Number(h.total_quantity),
          averagePrice: Number(h.average_price),
          totalInvested: Number(h.total_invested),
          currentPrice,
          changePercent: price?.change_percent
            ? Number(price.change_percent)
            : null,
          currentValue,
          profitLoss,
          profitLossPercent,
          logoUrl: h.assets.logo_url,
        };
      });

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
