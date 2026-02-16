import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function DELETE(request: Request) {
  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const holdingId = searchParams.get("holdingId");
  const userId = searchParams.get("userId");

  if (!holdingId || !userId) {
    return NextResponse.json({ error: "holdingId e userId obrigatorios" }, { status: 400 });
  }

  // Verificar que o holding pertence ao usuario
  const { data: holding } = await supabase
    .from("invest_holdings")
    .select("id")
    .eq("id", holdingId)
    .eq("user_id", userId)
    .single();

  if (!holding) {
    return NextResponse.json({ error: "Holding nao encontrado" }, { status: 404 });
  }

  // Deletar transacoes relacionadas primeiro
  await supabase
    .from("invest_transactions")
    .delete()
    .eq("holding_id", holdingId)
    .eq("user_id", userId);

  // Deletar o holding
  const { error } = await supabase
    .from("invest_holdings")
    .delete()
    .eq("id", holdingId)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
