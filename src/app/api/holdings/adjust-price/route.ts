import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { PriceAdjustment } from "@/types/database";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  const supabase = getSupabase();
  const { holdingId, userId, newPrice, note } = await request.json();

  if (!holdingId || !userId || newPrice === undefined || newPrice === null) {
    return NextResponse.json(
      { error: "Missing holdingId, userId, or newPrice" },
      { status: 400 }
    );
  }

  if (typeof newPrice !== "number" || newPrice < 0) {
    return NextResponse.json(
      { error: "newPrice must be a non-negative number" },
      { status: 400 }
    );
  }

  // Fetch current holding
  const { data: holding, error: holdingError } = await supabase
    .from("invest_holdings")
    .select("id, average_price, total_invested, total_quantity, price_adjustments, user_id")
    .eq("id", holdingId)
    .eq("user_id", userId)
    .single();

  if (holdingError || !holding) {
    return NextResponse.json({ error: "Holding not found" }, { status: 404 });
  }

  const oldPrice = Number(holding.average_price);
  const oldTotalInvested = Number(holding.total_invested);
  const quantity = Number(holding.total_quantity);
  const newTotalInvested = newPrice * quantity;

  // Create adjustment record
  const adjustment: PriceAdjustment = {
    date: new Date().toISOString(),
    oldPrice,
    newPrice,
    oldTotalInvested,
    newTotalInvested,
    note: note || undefined,
  };

  const existingAdjustments: PriceAdjustment[] = holding.price_adjustments || [];

  // Update holding with new price and log adjustment
  const { error: updateError } = await supabase
    .from("invest_holdings")
    .update({
      average_price: newPrice,
      total_invested: newTotalInvested,
      price_adjustments: [...existingAdjustments, adjustment],
    })
    .eq("id", holdingId);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update holding" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    adjustment,
    newAveragePrice: newPrice,
    newTotalInvested,
  });
}
