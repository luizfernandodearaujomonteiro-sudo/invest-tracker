import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { ManualOverrides } from "@/types/database";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  const supabase = getSupabase();
  const body = await request.json();
  const {
    userId,
    assetId,
    brokerId,
    quantity,
    averagePrice,
    dividendsAccumulated,
    rentComProventos,
    rentBruta,
    // Campos de renda fixa
    fixedIncomeIndex,
    fixedIncomeRate,
    maturityDate,
    snapshotValue,
  } = body as {
    userId: string;
    assetId: string;
    brokerId: string;
    quantity: number;
    averagePrice: number;
    dividendsAccumulated?: number;
    rentComProventos?: number;
    rentBruta?: number;
    fixedIncomeIndex?: string;
    fixedIncomeRate?: number;
    maturityDate?: string;
    snapshotValue?: number;
  };

  if (!userId || !assetId || !brokerId || !quantity) {
    return NextResponse.json({ error: "Campos obrigatorios faltando" }, { status: 400 });
  }

  const safeAvgPrice = averagePrice || 0;
  const totalInvested = quantity * safeAvgPrice;

  // Build manual overrides
  const overrides: ManualOverrides = {};
  if (dividendsAccumulated && dividendsAccumulated > 0) overrides.dividendsAccumulated = dividendsAccumulated;
  if (rentComProventos !== undefined && rentComProventos !== null) overrides.rentComProventos = rentComProventos;
  if (rentBruta !== undefined && rentBruta !== null) overrides.rentBruta = rentBruta;
  const manualOverrides = Object.keys(overrides).length > 0 ? overrides : null;

  // Find or create holding
  let { data: holding } = await supabase
    .from("invest_holdings")
    .select("id")
    .eq("user_id", userId)
    .eq("broker_id", brokerId)
    .eq("asset_id", assetId)
    .single();

  // Campos extras para renda fixa
  const fixedFields: Record<string, unknown> = {};
  if (fixedIncomeIndex) fixedFields.fixed_income_index = fixedIncomeIndex;
  if (fixedIncomeRate !== undefined) fixedFields.fixed_income_rate = fixedIncomeRate;
  if (maturityDate) fixedFields.maturity_date = maturityDate;
  if (snapshotValue) {
    fixedFields.snapshot_value = snapshotValue;
    fixedFields.snapshot_date = new Date().toISOString().split("T")[0];
  }

  if (!holding) {
    const { data: newHolding, error } = await supabase
      .from("invest_holdings")
      .insert({
        user_id: userId,
        broker_id: brokerId,
        asset_id: assetId,
        total_quantity: quantity,
        average_price: safeAvgPrice,
        total_invested: totalInvested,
        manual_overrides: manualOverrides,
        ...fixedFields,
      })
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    holding = newHolding;
  } else {
    // Update existing holding
    const { error } = await supabase
      .from("invest_holdings")
      .update({
        total_quantity: quantity,
        average_price: safeAvgPrice,
        total_invested: totalInvested,
        manual_overrides: manualOverrides,
        ...fixedFields,
      })
      .eq("id", holding.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Create buy transaction for record
  await supabase.from("invest_transactions").insert({
    user_id: userId,
    holding_id: holding!.id,
    type: "buy",
    quantity,
    price_per_unit: safeAvgPrice,
    total_value: totalInvested,
    fees: 0,
    executed_at: new Date().toISOString(),
    notes: "Importacao de posicao existente",
  });

  // Create dividend transaction if proventos
  if (dividendsAccumulated && dividendsAccumulated > 0) {
    await supabase.from("invest_transactions").insert({
      user_id: userId,
      holding_id: holding!.id,
      type: "dividend",
      quantity: 1,
      price_per_unit: dividendsAccumulated,
      total_value: dividendsAccumulated,
      fees: 0,
      executed_at: new Date().toISOString(),
      notes: "Proventos acumulados (importacao)",
    });
  }

  return NextResponse.json({ success: true, holdingId: holding!.id });
}
