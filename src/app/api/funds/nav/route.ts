import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchFundNavs, normalizeCnpj } from "@/lib/api/cvm";

export const maxDuration = 60; // Allow up to 60s for CVM ZIP download

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: Request) {
  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const holdingIds =
    searchParams
      .get("holdings")
      ?.split(",")
      .filter(Boolean) || [];

  if (holdingIds.length === 0) {
    return NextResponse.json({ results: {} });
  }

  // Fetch fund holdings with their asset CNPJ
  const { data: holdings, error } = await supabase
    .from("invest_holdings")
    .select(
      `
      id,
      total_quantity,
      total_invested,
      asset_id,
      invest_assets ( id, ticker, name, asset_type, cnpj )
    `
    )
    .in("id", holdingIds);

  if (error || !holdings || holdings.length === 0) {
    return NextResponse.json({ results: {} });
  }

  // Collect unique CNPJs to look up
  const cnpjToHoldings = new Map<
    string,
    Array<{ holdingId: string; quantity: number; invested: number }>
  >();

  for (const h of holdings) {
    const asset = h.invest_assets as unknown as Record<string, unknown>;
    const cnpj = asset?.cnpj as string | null;
    if (!cnpj) continue;

    const normalized = normalizeCnpj(cnpj);
    const list = cnpjToHoldings.get(normalized) || [];
    list.push({
      holdingId: h.id,
      quantity: Number(h.total_quantity),
      invested: Number(h.total_invested),
    });
    cnpjToHoldings.set(normalized, list);
  }

  if (cnpjToHoldings.size === 0) {
    return NextResponse.json({ results: {} });
  }

  // Check cache first (4 hour threshold for funds - CVM updates once per day)
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  const assetIds = holdings
    .map((h) => (h.invest_assets as unknown as Record<string, unknown>)?.id as string)
    .filter(Boolean);

  const { data: cached } = await supabase
    .from("invest_price_cache")
    .select("asset_id, current_price, fetched_at")
    .in("asset_id", assetIds)
    .gte("fetched_at", fourHoursAgo);

  const cachedMap = new Map(
    (cached || []).map((c) => [c.asset_id, c.current_price])
  );

  // Build results from cache
  const results: Record<
    string,
    { holdingId: string; vlQuota: number; currentValue: number; profitLoss: number; profitLossPercent: number }
  > = {};

  let needsFetch = false;
  for (const h of holdings) {
    const asset = h.invest_assets as unknown as Record<string, unknown>;
    const assetId = asset?.id as string;
    const cachedPrice = cachedMap.get(assetId);

    if (cachedPrice != null && cachedPrice > 0) {
      const quantity = Number(h.total_quantity);
      const invested = Number(h.total_invested);
      const currentValue = cachedPrice * quantity;
      results[h.id] = {
        holdingId: h.id,
        vlQuota: cachedPrice,
        currentValue,
        profitLoss: currentValue - invested,
        profitLossPercent: invested > 0 ? ((currentValue - invested) / invested) * 100 : 0,
      };
    } else {
      needsFetch = true;
    }
  }

  // If all cached, return early
  if (!needsFetch) {
    return NextResponse.json({ results });
  }

  // Fetch fresh NAVs from CVM
  try {
    const cnpjs = Array.from(cnpjToHoldings.keys());
    const navMap = await fetchFundNavs(cnpjs);

    // Update cache and build results for non-cached holdings
    for (const h of holdings) {
      if (results[h.id]) continue; // Already from cache

      const asset = h.invest_assets as unknown as Record<string, unknown>;
      const cnpj = asset?.cnpj as string | null;
      const assetId = asset?.id as string;
      if (!cnpj) continue;

      const nav = navMap.get(normalizeCnpj(cnpj));
      if (!nav || nav.vlQuota <= 0) continue;

      const quantity = Number(h.total_quantity);
      const invested = Number(h.total_invested);
      const currentValue = nav.vlQuota * quantity;

      results[h.id] = {
        holdingId: h.id,
        vlQuota: nav.vlQuota,
        currentValue,
        profitLoss: currentValue - invested,
        profitLossPercent: invested > 0 ? ((currentValue - invested) / invested) * 100 : 0,
      };

      // Cache in price_cache
      await supabase.from("invest_price_cache").upsert(
        {
          asset_id: assetId,
          current_price: nav.vlQuota,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "asset_id" }
      );
    }
  } catch (error) {
    console.error("Erro ao buscar NAVs da CVM:", error);
    // Return whatever we have from cache
  }

  return NextResponse.json({ results });
}
