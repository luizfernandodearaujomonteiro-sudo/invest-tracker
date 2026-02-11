"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useAssetPrice, usePriceHistory } from "@/hooks/usePriceHistory";
import { usePortfolio } from "@/hooks/usePortfolio";
import { PriceChart } from "@/components/charts/PriceChart";
import { ChartDateFilter } from "@/components/charts/ChartDateFilter";
import { PercentBadge } from "@/components/shared/PercentBadge";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Plus, ArrowLeft } from "lucide-react";
import { formatCurrency, formatPercent, formatQuantity } from "@/lib/utils/format";
import { ASSET_TYPE_LABELS } from "@/lib/utils/constants";
import type { DateRange } from "@/types/portfolio";
import Link from "next/link";

export default function AssetDetailPage() {
  const { ticker } = useParams<{ ticker: string }>();
  const [range, setRange] = useState<DateRange>("1M");
  const [txFormOpen, setTxFormOpen] = useState(false);

  const { data: price, isLoading: priceLoading } = useAssetPrice(ticker);
  const { data: history, isLoading: historyLoading } = usePriceHistory(
    ticker,
    range
  );
  const { data: portfolio } = usePortfolio();

  // Find user's holdings for this asset
  const holdings = (portfolio || []).filter(
    (a) => a.ticker.toUpperCase() === ticker.toUpperCase()
  );
  const totalQty = holdings.reduce((acc, h) => acc + h.totalQuantity, 0);
  const totalInvested = holdings.reduce((acc, h) => acc + h.totalInvested, 0);
  const avgPrice = totalQty > 0 ? totalInvested / totalQty : 0;

  const currentPrice = price?.currentPrice;
  const currentValue = currentPrice ? currentPrice * totalQty : null;
  const profitLoss = currentValue !== null ? currentValue - totalInvested : null;
  const profitLossPercent =
    profitLoss !== null && totalInvested > 0
      ? (profitLoss / totalInvested) * 100
      : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl font-bold">{ticker.toUpperCase()}</h1>
            {price && (
              <Badge variant="secondary">
                {ASSET_TYPE_LABELS[
                  holdings[0]?.assetType as keyof typeof ASSET_TYPE_LABELS
                ] || "Ativo"}
              </Badge>
            )}
          </div>
          {priceLoading ? (
            <Skeleton className="h-10 w-48" />
          ) : price ? (
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold">
                {formatCurrency(price.currentPrice, price.currency || "BRL")}
              </span>
              <PercentBadge value={price.changePercent} />
            </div>
          ) : (
            <p className="text-muted-foreground">
              Preco indisponivel
            </p>
          )}
        </div>
        <Button onClick={() => setTxFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Transacao
        </Button>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Historico de Preco</CardTitle>
          <ChartDateFilter selected={range} onChange={setRange} />
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <Skeleton className="h-[400px] w-full" />
          ) : (
            <PriceChart data={history || []} />
          )}
        </CardContent>
      </Card>

      {/* Position */}
      {totalQty > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sua Posicao</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="text-sm text-muted-foreground">Quantidade</div>
                <div className="text-lg font-semibold">
                  {formatQuantity(totalQty)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">
                  Preco Medio
                </div>
                <div className="text-lg font-semibold">
                  {formatCurrency(avgPrice)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">
                  Total Investido
                </div>
                <div className="text-lg font-semibold">
                  {formatCurrency(totalInvested)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">
                  Lucro / Perda
                </div>
                <div className="flex items-baseline gap-2">
                  <span
                    className={`text-lg font-semibold ${
                      (profitLoss ?? 0) >= 0
                        ? "text-emerald-600"
                        : "text-red-600"
                    }`}
                  >
                    {profitLoss !== null ? formatCurrency(profitLoss) : "--"}
                  </span>
                  <PercentBadge value={profitLossPercent} />
                </div>
              </div>
            </div>

            {/* Per broker breakdown */}
            {holdings.length > 1 && (
              <div className="mt-4 border-t pt-4">
                <div className="text-sm font-medium text-muted-foreground mb-2">
                  Por Corretora
                </div>
                <div className="space-y-2">
                  {holdings.map((h) => (
                    <div
                      key={h.holdingId}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>{h.brokerName}</span>
                      <span className="font-mono">
                        {formatQuantity(h.totalQuantity)} un. @{" "}
                        {formatCurrency(h.averagePrice)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <TransactionForm open={txFormOpen} onOpenChange={setTxFormOpen} />
    </div>
  );
}
