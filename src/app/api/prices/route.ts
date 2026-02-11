import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchPrice } from "@/lib/api/price-fetcher";
import type { AssetType } from "@/types/database";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: Request) {
  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const tickers = searchParams.get("tickers")?.split(",") || [];

  if (tickers.length === 0) {
    return NextResponse.json({ error: "No tickers provided" }, { status: 400 });
  }

  // Fetch asset info for all tickers
  const { data: assets } = await supabase
    .from("assets")
    .select("id, ticker, asset_type, coingecko_id")
    .in("ticker", tickers);

  if (!assets || assets.length === 0) {
    return NextResponse.json({ error: "No assets found" }, { status: 404 });
  }

  // Check cache first (5 min threshold)
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const assetIds = assets.map((a) => a.id);

  const { data: cached } = await supabase
    .from("price_cache")
    .select("*")
    .in("asset_id", assetIds)
    .gte("fetched_at", fiveMinAgo);

  const cachedMap = new Map(
    (cached || []).map((c) => [c.asset_id, c])
  );

  const results: Record<string, unknown> = {};
  const toFetch = assets.filter((a) => !cachedMap.has(a.id));

  // Return cached data
  for (const asset of assets) {
    const c = cachedMap.get(asset.id);
    if (c) {
      results[asset.ticker] = {
        currentPrice: c.current_price,
        changePercent: c.change_percent,
        volume: c.volume,
        fetchedAt: c.fetched_at,
      };
    }
  }

  // Fetch missing prices
  const fetchPromises = toFetch.map(async (asset) => {
    try {
      if (asset.asset_type === "fixed_income") return;

      const price = await fetchPrice(
        asset.ticker,
        asset.asset_type as AssetType,
        asset.coingecko_id
      );

      // Upsert cache
      await supabase.from("price_cache").upsert(
        {
          asset_id: asset.id,
          current_price: price.currentPrice,
          open_price: price.openPrice,
          high_price: price.highPrice,
          low_price: price.lowPrice,
          previous_close: price.previousClose,
          change_percent: price.changePercent,
          volume: price.volume,
          market_cap: price.marketCap,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "asset_id" }
      );

      results[asset.ticker] = {
        currentPrice: price.currentPrice,
        changePercent: price.changePercent,
        volume: price.volume,
        fetchedAt: price.fetchedAt,
      };
    } catch (error) {
      console.error(`Failed to fetch price for ${asset.ticker}:`, error);
    }
  });

  await Promise.allSettled(fetchPromises);

  return NextResponse.json(results);
}
