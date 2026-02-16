import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { searchCvmFunds } from "@/lib/api/cvm";

export const maxDuration = 60;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query || query.length < 3) {
    return NextResponse.json(
      { error: "Query deve ter pelo menos 3 caracteres" },
      { status: 400 }
    );
  }

  const supabase = getSupabase();

  // Try Supabase registry first (instant, if synced)
  try {
    // Build ilike pattern: "trend valor" → "%trend%valor%"
    const pattern = `%${query.split(/\s+/).join("%")}%`;
    // Also try CNPJ search (digits only)
    const cnpjDigits = query.replace(/[.\-/\s]/g, "");
    const isCnpjSearch = /^\d{5,}$/.test(cnpjDigits);

    let registryQuery = supabase
      .from("invest_fund_registry")
      .select("cnpj, name, classe, gestor, admin");

    if (isCnpjSearch) {
      registryQuery = registryQuery.or(`name.ilike.${pattern},cnpj.like.${cnpjDigits}%`);
    } else {
      registryQuery = registryQuery.ilike("name", pattern);
    }

    const { data: registryResults, error } = await registryQuery.limit(15);

    if (!error && registryResults && registryResults.length > 0) {
      return NextResponse.json({
        results: registryResults.map((r) => ({
          cnpj: r.cnpj,
          name: r.name,
          classe: r.classe || "",
          gestor: r.gestor || "",
          admin: r.admin || "",
        })),
        source: "cache",
      });
    }

    // Check if registry has any data at all
    const { count } = await supabase
      .from("invest_fund_registry")
      .select("cnpj", { count: "exact", head: true });

    if (count && count > 0) {
      // Registry is populated but no matches - return empty
      return NextResponse.json({ results: [], source: "cache" });
    }
  } catch {
    // Supabase query failed, fallback to CVM
  }

  // Fallback: download CVM cadastro directly (slow, ~17MB)
  try {
    const results = await searchCvmFunds(query, 15);
    return NextResponse.json({ results, source: "cvm_direct" });
  } catch (error) {
    console.error("Erro ao buscar fundos CVM:", error);
    return NextResponse.json(
      { error: "Sincronize o cadastro CVM nas Configuracoes primeiro" },
      { status: 500 }
    );
  }
}
