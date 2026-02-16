import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchBcbRates, type BcbIndex } from "@/lib/api/bcb";
import {
  calculateFixedIncome,
  type FixedIncomeIndex,
} from "@/lib/utils/fixed-income";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface FixedIncomeApiResult {
  holdingId: string;
  ticker: string;
  grossValue: number;
  netValue: number;
  grossReturn: number;
  netReturn: number;
  iofAmount: number;
  irAmount: number;
  holdingDays: number;
}

export async function GET(request: Request) {
  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const holdingIds = searchParams.get("holdings")?.split(",").filter(Boolean) || [];

  if (holdingIds.length === 0) {
    return NextResponse.json({ results: {} });
  }

  // Buscar holdings com dados de renda fixa
  const { data: holdings, error } = await supabase
    .from("invest_holdings")
    .select(`
      id,
      total_invested,
      fixed_income_rate,
      fixed_income_index,
      maturity_date,
      snapshot_value,
      snapshot_date,
      asset_id,
      invest_assets ( id, ticker, name, asset_type )
    `)
    .in("id", holdingIds)
    .not("fixed_income_index", "is", null);

  if (error || !holdings || holdings.length === 0) {
    return NextResponse.json({ results: {} });
  }

  // Buscar TODAS as transacoes de compra de cada holding (para calcular cada aporte individualmente)
  const { data: transactions } = await supabase
    .from("invest_transactions")
    .select("holding_id, executed_at, total_value")
    .in("holding_id", holdingIds)
    .eq("type", "buy")
    .order("executed_at", { ascending: true });

  // Agrupar transacoes por holding
  const txByHolding = new Map<string, Array<{ date: string; amount: number }>>();
  for (const tx of transactions || []) {
    const list = txByHolding.get(tx.holding_id) || [];
    list.push({ date: tx.executed_at, amount: Number(tx.total_value) });
    txByHolding.set(tx.holding_id, list);
  }

  // Determinar quais series do BCB precisamos e a data mais antiga
  const indicesToFetch = new Set<BcbIndex>();
  let earliestDate = new Date();

  for (const h of holdings) {
    const holding = h as Record<string, unknown>;
    const index = holding.fixed_income_index as string;
    if (index && index !== "prefixado") {
      indicesToFetch.add(index as BcbIndex);
    }
    const txList = txByHolding.get(h.id);
    if (txList && txList.length > 0) {
      const firstDate = new Date(txList[0].date);
      if (firstDate < earliestDate) earliestDate = firstDate;
    }
  }

  // Buscar taxas do BCB em paralelo (1 chamada por serie, nao por holding)
  const ratesMap = new Map<BcbIndex, Array<{ date: string; value: number }>>();
  const fetchPromises = Array.from(indicesToFetch).map(async (index) => {
    const rates = await fetchBcbRates(index, earliestDate);
    ratesMap.set(index, rates);
  });
  await Promise.allSettled(fetchPromises);

  // Calcular valor para cada holding
  const results: Record<string, FixedIncomeApiResult> = {};

  for (const h of holdings) {
    const holding = h as Record<string, unknown>;
    const asset = holding.invest_assets as Record<string, unknown>;
    const index = holding.fixed_income_index as FixedIncomeIndex;
    const rate = Number(holding.fixed_income_rate) || 0;
    const ticker = asset.ticker as string;
    const totalInvestedDb = Number(holding.total_invested) || 0;
    const snapshotValue = holding.snapshot_value ? Number(holding.snapshot_value) : null;
    const snapshotDate = holding.snapshot_date ? new Date(holding.snapshot_date as string) : null;
    const txList = txByHolding.get(h.id);

    if (!index) continue;

    let totalGrossValue = 0;
    let totalNetValue = 0;
    let totalIof = 0;
    let totalIr = 0;
    let totalInvested = totalInvestedDb;
    let holdingDays = 0;

    if (snapshotValue && snapshotDate) {
      // Modo snapshot: usa valor importado da corretora como base
      // e calcula rendimento "pra frente" desde a data do snapshot
      const snapshotDateStr = snapshotDate.toISOString().split("T")[0];

      let rates: Array<{ date: string; value: number }> = [];
      if (index !== "prefixado") {
        const allRates = ratesMap.get(index as BcbIndex) || [];
        rates = allRates.filter((r) => r.date >= snapshotDateStr);
      }

      const result = calculateFixedIncome({
        totalInvested: snapshotValue, // base = valor no snapshot (nao o total investido)
        purchaseDate: snapshotDate,
        index,
        rate,
        ticker,
        rates,
      });

      // grossValue ja inclui rendimento desde snapshot
      totalGrossValue = result.grossValue;
      // IOF/IR incidem sobre o rendimento TOTAL (desde investimento original)
      const totalGrossProfit = totalGrossValue - totalInvested;
      holdingDays = Math.max(result.holdingDays, 30); // snapshot implica posicao antiga
      totalIof = 0; // posicao importada ja passou dos 30 dias de IOF
      if (totalGrossProfit > 0) {
        const irRate = 0.15; // posicao antiga: assume aliquota minima (>720 dias)
        totalIr = totalGrossProfit * irRate;
      }
      totalNetValue = totalGrossValue - totalIof - totalIr;
    } else if (txList && txList.length > 0) {
      // Modo transacoes: calcula cada aporte individualmente
      totalInvested = 0;

      for (const tx of txList) {
        const purchaseDate = new Date(tx.date);
        const purchaseDateStr = purchaseDate.toISOString().split("T")[0];

        let rates: Array<{ date: string; value: number }> = [];
        if (index !== "prefixado") {
          const allRates = ratesMap.get(index as BcbIndex) || [];
          rates = allRates.filter((r) => r.date >= purchaseDateStr);
        }

        const result = calculateFixedIncome({
          totalInvested: tx.amount,
          purchaseDate,
          index,
          rate,
          ticker,
          rates,
        });

        totalGrossValue += result.grossValue;
        totalNetValue += result.netValue;
        totalIof += result.iofAmount;
        totalIr += result.irAmount;
        totalInvested += tx.amount;
      }

      const firstPurchase = new Date(txList[0].date);
      holdingDays = Math.floor(
        (Date.now() - firstPurchase.getTime()) / (1000 * 60 * 60 * 24)
      );
    } else {
      continue;
    }

    const grossReturn = totalInvested > 0
      ? ((totalGrossValue - totalInvested) / totalInvested) * 100
      : 0;
    const netReturn = totalInvested > 0
      ? ((totalNetValue - totalInvested) / totalInvested) * 100
      : 0;

    results[h.id] = {
      holdingId: h.id,
      ticker,
      grossValue: totalGrossValue,
      netValue: totalNetValue,
      grossReturn,
      netReturn,
      iofAmount: totalIof,
      irAmount: totalIr,
      holdingDays,
    };
  }

  return NextResponse.json({ results });
}
