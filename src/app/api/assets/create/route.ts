import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  const supabase = getSupabase();
  const body = await request.json();
  const { ticker, name, assetType, currency, exchange, cnpj } = body as {
    ticker: string;
    name: string;
    assetType: string;
    currency: string;
    exchange?: string;
    cnpj?: string;
  };

  if (!ticker || !name || !assetType) {
    return NextResponse.json({ error: "ticker, name e assetType obrigatorios" }, { status: 400 });
  }

  // Verificar se ja existe (por ticker ou CNPJ)
  let existingQuery = supabase
    .from("invest_assets")
    .select("id, ticker, name, asset_type, currency");

  if (cnpj) {
    existingQuery = existingQuery.eq("cnpj", cnpj);
  } else {
    existingQuery = existingQuery.eq("ticker", ticker);
  }

  const { data: existing } = await existingQuery.single();

  if (existing) {
    return NextResponse.json({ asset: existing });
  }

  // Criar novo ativo
  const insertData: Record<string, unknown> = {
    ticker,
    name,
    asset_type: assetType,
    currency: currency || "BRL",
    exchange: exchange || "Renda Fixa",
    is_active: true,
  };
  if (cnpj) insertData.cnpj = cnpj;

  const { data: asset, error } = await supabase
    .from("invest_assets")
    .insert(insertData)
    .select("id, ticker, name, asset_type, currency")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ asset, created: true });
}
