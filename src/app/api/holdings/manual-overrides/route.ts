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
  const { holdingId, userId, overrides } = await request.json() as {
    holdingId: string;
    userId: string;
    overrides: ManualOverrides;
  };

  if (!holdingId || !userId) {
    return NextResponse.json(
      { error: "Missing holdingId or userId" },
      { status: 400 }
    );
  }

  // Verify holding belongs to user
  const { data: holding, error: holdingError } = await supabase
    .from("invest_holdings")
    .select("id, manual_overrides")
    .eq("id", holdingId)
    .eq("user_id", userId)
    .single();

  if (holdingError || !holding) {
    return NextResponse.json({ error: "Holding not found" }, { status: 404 });
  }

  // Merge with existing overrides
  const existing: ManualOverrides = holding.manual_overrides || {};
  const merged: ManualOverrides = { ...existing, ...overrides };

  // Remove undefined/null values
  for (const key of Object.keys(merged) as (keyof ManualOverrides)[]) {
    if (merged[key] === undefined || merged[key] === null) {
      delete merged[key];
    }
  }

  const { error: updateError } = await supabase
    .from("invest_holdings")
    .update({ manual_overrides: Object.keys(merged).length > 0 ? merged : null })
    .eq("id", holdingId);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update overrides" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, overrides: merged });
}
