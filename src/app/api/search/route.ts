import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: Request) {
  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 1) {
    return NextResponse.json({ results: [] });
  }

  // Search in local assets table
  const { data: assets } = await supabase
    .from("invest_assets")
    .select("id, ticker, name, asset_type, currency, logo_url")
    .or(`ticker.ilike.%${q}%,name.ilike.%${q}%`)
    .eq("is_active", true)
    .order("ticker")
    .limit(20);

  return NextResponse.json({ results: assets || [] });
}
