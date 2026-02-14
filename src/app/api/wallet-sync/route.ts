import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { CHAIN_REGISTRY } from "@/lib/api/blockchain";
import type { WalletAddress, ChainId } from "@/types/database";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Fetch current USD prices from CoinGecko for a list of coingecko IDs
async function fetchCurrentPrices(
  coingeckoIds: string[]
): Promise<Record<string, number>> {
  if (coingeckoIds.length === 0) return {};
  const apiKey = process.env.COINGECKO_API_KEY || "";
  const ids = coingeckoIds.join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
  try {
    const res = await fetch(url, {
      headers: apiKey ? { "x-cg-demo-api-key": apiKey } : {},
    });
    if (!res.ok) return {};
    const data = await res.json();
    const prices: Record<string, number> = {};
    for (const id of coingeckoIds) {
      if (data[id]?.usd) prices[id] = data[id].usd;
    }
    return prices;
  } catch {
    return {};
  }
}

// ── Main sync route ──
// Syncs balances (quantities) from blockchain.
// For NEW holdings, sets initial cost basis using current market price.
// For EXISTING holdings, only updates quantity (cost basis managed by user).

export async function POST(request: Request) {
  const supabase = getSupabase();
  const { brokerId, userId } = await request.json();

  if (!brokerId || !userId) {
    return NextResponse.json({ error: "Missing brokerId or userId" }, { status: 400 });
  }

  // 1. Load broker and validate
  const { data: broker, error: brokerError } = await supabase
    .from("invest_brokers")
    .select("id, broker_type, wallet_addresses, user_id")
    .eq("id", brokerId)
    .eq("user_id", userId)
    .single();

  if (brokerError || !broker) {
    return NextResponse.json({ error: "Broker not found" }, { status: 404 });
  }
  if (broker.broker_type !== "wallet") {
    return NextResponse.json({ error: "Broker is not a wallet" }, { status: 400 });
  }

  const addresses: WalletAddress[] = broker.wallet_addresses || [];
  if (addresses.length === 0) {
    return NextResponse.json({ error: "No wallet addresses configured" }, { status: 400 });
  }

  // 2. Fetch balances from each chain
  const chainResults: Array<{
    chain: ChainId;
    ticker: string;
    balance: number;
    error?: string;
  }> = [];

  await Promise.allSettled(
    addresses.map(async (wa) => {
      const config = CHAIN_REGISTRY[wa.chain];
      if (!config) {
        chainResults.push({ chain: wa.chain, ticker: "?", balance: 0, error: "Unknown chain" });
        return;
      }
      try {
        const balance = await config.fetchBalance(wa.address);
        chainResults.push({ chain: wa.chain, ticker: config.nativeTicker, balance });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        chainResults.push({ chain: wa.chain, ticker: config.nativeTicker, balance: 0, error: message });
      }
    })
  );

  // 3. Aggregate balances by ticker
  const balanceByTicker = new Map<string, number>();

  for (const r of chainResults) {
    if (r.error) continue;
    balanceByTicker.set(r.ticker, (balanceByTicker.get(r.ticker) || 0) + r.balance);
  }

  // 4. For each ticker, upsert holding
  const syncResults: Array<{ ticker: string; quantity: number; avgPrice: number; status: string }> = [];

  // Collect coingecko IDs for assets that need current prices (new holdings)
  const tickerAssets = new Map<string, { id: string; coingecko_id: string | null }>();

  for (const [ticker] of balanceByTicker) {
    const { data: asset } = await supabase
      .from("invest_assets")
      .select("id, coingecko_id")
      .eq("ticker", ticker)
      .eq("asset_type", "crypto")
      .single();

    if (asset) {
      tickerAssets.set(ticker, asset);
    }
  }

  // Check which holdings already exist
  const existingHoldings = new Map<string, string>(); // ticker -> holding id
  const needPriceTickers: string[] = [];

  for (const [ticker] of balanceByTicker) {
    const asset = tickerAssets.get(ticker);
    if (!asset) continue;

    const { data: holding } = await supabase
      .from("invest_holdings")
      .select("id, average_price")
      .eq("user_id", userId)
      .eq("broker_id", brokerId)
      .eq("asset_id", asset.id)
      .single();

    if (holding) {
      existingHoldings.set(ticker, holding.id);
      // Also fetch price if existing holding has no cost basis
      if (!holding.average_price || holding.average_price === 0) {
        if (asset.coingecko_id) needPriceTickers.push(ticker);
      }
    } else {
      if (asset.coingecko_id) needPriceTickers.push(ticker);
    }
  }

  // Fetch current prices for new holdings or holdings with no cost basis
  const coingeckoIds = needPriceTickers
    .map(t => tickerAssets.get(t)?.coingecko_id)
    .filter((id): id is string => !!id);
  const currentPrices = await fetchCurrentPrices([...new Set(coingeckoIds)]);

  // Now upsert each holding
  for (const [ticker, totalBalance] of balanceByTicker) {
    const asset = tickerAssets.get(ticker);
    if (!asset) {
      syncResults.push({ ticker, quantity: totalBalance, avgPrice: 0, status: "asset_not_found" });
      continue;
    }

    const existingId = existingHoldings.get(ticker);

    if (existingId) {
      // Existing holding: update quantity only
      const updateData: Record<string, number> = { total_quantity: totalBalance };

      // If holding has no cost basis yet, set it using current price
      if (needPriceTickers.includes(ticker) && asset.coingecko_id) {
        const price = currentPrices[asset.coingecko_id];
        if (price) {
          updateData.average_price = price;
          updateData.total_invested = price * totalBalance;
        }
      }

      await supabase
        .from("invest_holdings")
        .update(updateData)
        .eq("id", existingId);

      const avgPrice = updateData.average_price || 0;
      syncResults.push({ ticker, quantity: totalBalance, avgPrice, status: "updated" });
    } else {
      if (totalBalance > 0) {
        // New holding: use current price as initial cost basis
        let avgPrice = 0;
        let totalInvested = 0;

        if (asset.coingecko_id) {
          const price = currentPrices[asset.coingecko_id];
          if (price) {
            avgPrice = price;
            totalInvested = price * totalBalance;
          }
        }

        await supabase
          .from("invest_holdings")
          .insert({
            user_id: userId,
            broker_id: brokerId,
            asset_id: asset.id,
            total_quantity: totalBalance,
            average_price: avgPrice,
            total_invested: totalInvested,
          });
        syncResults.push({ ticker, quantity: totalBalance, avgPrice, status: "created" });
      } else {
        syncResults.push({ ticker, quantity: 0, avgPrice: 0, status: "skipped_zero" });
      }
    }
  }

  // 5. Update last_synced_at
  await supabase
    .from("invest_brokers")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", brokerId);

  return NextResponse.json({
    success: true,
    synced: syncResults,
    errors: chainResults.filter((r) => r.error),
    syncedAt: new Date().toISOString(),
  });
}
