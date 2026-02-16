import { NextResponse } from "next/server";
import { fetchFundNavs, normalizeCnpj } from "@/lib/api/cvm";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * GET /api/funds/quota?cnpj=XXXXX
 * Returns the latest VL_QUOTA for a single fund CNPJ.
 * Checks price_cache first (4h TTL), then fetches from CVM.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cnpj = searchParams.get("cnpj")?.trim();

  if (!cnpj) {
    return NextResponse.json({ error: "cnpj obrigatorio" }, { status: 400 });
  }

  const normalized = normalizeCnpj(cnpj);
  const supabase = getSupabase();

  // Check if we have a cached price for an asset with this CNPJ
  const { data: asset } = await supabase
    .from("invest_assets")
    .select("id")
    .eq("cnpj", normalized)
    .limit(1)
    .maybeSingle();

  if (asset) {
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const { data: cached } = await supabase
      .from("invest_price_cache")
      .select("current_price, fetched_at")
      .eq("asset_id", asset.id)
      .gte("fetched_at", fourHoursAgo)
      .maybeSingle();

    if (cached?.current_price && cached.current_price > 0) {
      return NextResponse.json({ vlQuota: cached.current_price, source: "cache" });
    }
  }

  // Fetch from CVM
  try {
    const navMap = await fetchFundNavs([normalized]);
    const nav = navMap.get(normalized);

    if (!nav || nav.vlQuota <= 0) {
      return NextResponse.json({ error: "VL_QUOTA nao encontrado na CVM" }, { status: 404 });
    }

    // Cache if asset exists
    if (asset) {
      await supabase.from("invest_price_cache").upsert(
        {
          asset_id: asset.id,
          current_price: nav.vlQuota,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "asset_id" }
      );
    }

    return NextResponse.json({ vlQuota: nav.vlQuota, date: nav.date, source: "cvm" });
  } catch (error) {
    console.error("Erro ao buscar VL_QUOTA:", error);
    return NextResponse.json({ error: "Erro ao buscar dados da CVM" }, { status: 500 });
  }
}
