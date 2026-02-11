"use client";

import { useQuery } from "@tanstack/react-query";
import type { DateRange, HistoricalPrice } from "@/types/portfolio";

export function usePriceHistory(ticker: string, range: DateRange) {
  return useQuery({
    queryKey: ["priceHistory", ticker, range],
    queryFn: async (): Promise<HistoricalPrice[]> => {
      const res = await fetch(
        `/api/prices/history?ticker=${ticker}&range=${range}`
      );
      if (!res.ok) throw new Error("Failed to fetch history");
      const data = await res.json();
      return data.data || [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!ticker,
  });
}

export function useAssetPrice(ticker: string) {
  return useQuery({
    queryKey: ["assetPrice", ticker],
    queryFn: async () => {
      const res = await fetch(`/api/prices/${ticker}`);
      if (!res.ok) throw new Error("Failed to fetch price");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    enabled: !!ticker,
  });
}
