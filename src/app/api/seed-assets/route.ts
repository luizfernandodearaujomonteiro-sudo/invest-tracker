import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { AssetType } from "@/types/database";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface BrapiStock {
  stock: string;
  name: string;
  type: string;
  logo: string | null;
}

// Known BR ETF tickers (type "fund" on Brapi but are ETFs, not FIIs)
const KNOWN_ETF_TICKERS = new Set([
  "BOVA11", "IVVB11", "HASH11", "SMAL11", "DIVO11", "BOVV11", "SPXI11",
  "NASD11", "GOLD11", "MATB11", "FIND11", "PIBB11", "ECOO11", "ISUS11",
  "BRAX11", "SMAC11", "XFIX11", "IMAB11", "IRFM11", "FIXA11", "B5P211",
  "IB5M11", "UTEC11", "TECK11", "SHOT11", "GENB11", "ACWI11", "WRLD11",
  "EURP11", "ASIA11", "DNAI11", "FOOD11", "JOGO11", "NFTS11", "QDFI11",
  "QBTC11", "QETH11", "ETHE11", "BITH11", "DEFI11", "WEB311", "META11",
  "CRPT11", "5GTK11", "BLOK11",
]);

function classifyBrapiType(ticker: string, brapiType: string): AssetType {
  if (brapiType === "bdr" || brapiType === "dr") return "br_bdr";
  if (brapiType === "fund") {
    if (KNOWN_ETF_TICKERS.has(ticker)) return "br_etf";
    return "br_fii";
  }
  return "br_stock";
}

export async function POST() {
  const supabase = getSupabase();
  let totalInserted = 0;
  let totalSkipped = 0;
  let page = 1;
  const limit = 100;

  try {
    // Fetch all pages from Brapi
    while (true) {
      const url = `https://brapi.dev/api/quote/list?sortBy=name&sortOrder=asc&limit=${limit}&page=${page}&token=${process.env.BRAPI_TOKEN || ""}`;
      const res = await fetch(url);
      if (!res.ok) {
        return NextResponse.json(
          { error: `Brapi error: ${res.status}`, totalInserted, totalSkipped },
          { status: 500 }
        );
      }

      const data = await res.json();
      const stocks: BrapiStock[] = data.stocks || [];

      if (stocks.length === 0) break;

      // Prepare rows
      const rows = stocks.map((s) => ({
        ticker: s.stock,
        name: s.name || s.stock,
        asset_type: classifyBrapiType(s.stock, s.type),
        currency: "BRL" as const,
        exchange: "B3",
        logo_url: s.logo || null,
        is_active: true,
      }));

      // Upsert (skip conflicts on ticker)
      const { data: inserted, error } = await supabase
        .from("invest_assets")
        .upsert(rows, { onConflict: "ticker", ignoreDuplicates: true })
        .select("id");

      if (error) {
        console.error("Supabase upsert error:", error);
      }

      totalInserted += inserted?.length || 0;
      totalSkipped += stocks.length - (inserted?.length || 0);

      if (!data.hasNextPage) break;
      page++;
    }

    return NextResponse.json({
      success: true,
      totalInserted,
      totalSkipped,
      totalPages: page,
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Failed to seed assets", totalInserted },
      { status: 500 }
    );
  }
}
