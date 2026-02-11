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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const supabase = getSupabase();

  // Find asset
  const { data: asset } = await supabase
    .from("assets")
    .select("id, ticker, asset_type, coingecko_id")
    .eq("ticker", ticker.toUpperCase())
    .single();

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  // Check cache
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: cached } = await supabase
    .from("price_cache")
    .select("*")
    .eq("asset_id", asset.id)
    .gte("fetched_at", fiveMinAgo)
    .single();

  if (cached) {
    return NextResponse.json({
      ticker: asset.ticker,
      currentPrice: cached.current_price,
      openPrice: cached.open_price,
      highPrice: cached.high_price,
      lowPrice: cached.low_price,
      previousClose: cached.previous_close,
      changePercent: cached.change_percent,
      volume: cached.volume,
      marketCap: cached.market_cap,
      fetchedAt: cached.fetched_at,
    });
  }

  try {
    const price = await fetchPrice(
      asset.ticker,
      asset.asset_type as AssetType,
      asset.coingecko_id
    );

    // Update cache
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

    return NextResponse.json(price);
  } catch (error) {
    console.error(`Price fetch error for ${ticker}:`, error);
    return NextResponse.json(
      { error: `Failed to fetch price for ${ticker}` },
      { status: 502 }
    );
  }
}
