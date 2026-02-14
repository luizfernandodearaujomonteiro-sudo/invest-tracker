import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchHistory } from "@/lib/api/price-fetcher";
import type { AssetType } from "@/types/database";
import type { DateRange } from "@/types/portfolio";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const VALID_RANGES: DateRange[] = ["1D", "1W", "1M", "3M", "1Y", "5Y", "MAX"];

export async function GET(request: Request) {
  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker");
  const range = searchParams.get("range") as DateRange;

  if (!ticker) {
    return NextResponse.json({ error: "ticker required" }, { status: 400 });
  }

  if (!range || !VALID_RANGES.includes(range)) {
    return NextResponse.json(
      { error: "Invalid range. Use: 1D, 1W, 1M, 3M, 1Y, 5Y, MAX" },
      { status: 400 }
    );
  }

  const { data: asset } = await supabase
    .from("invest_assets")
    .select("id, ticker, asset_type, coingecko_id")
    .eq("ticker", ticker.toUpperCase())
    .single();

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  try {
    const history = await fetchHistory(
      asset.ticker,
      asset.asset_type as AssetType,
      range,
      asset.coingecko_id
    );

    return NextResponse.json({
      ticker: asset.ticker,
      range,
      data: history,
    });
  } catch (error) {
    console.error(`History fetch error for ${ticker}:`, error);
    return NextResponse.json(
      { error: `Failed to fetch history for ${ticker}` },
      { status: 502 }
    );
  }
}
