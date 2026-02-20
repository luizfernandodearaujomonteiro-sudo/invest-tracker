"use client";

import { useState, useMemo, Fragment } from "react";
import Link from "next/link";
import { ChevronRight, ChevronDown, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDeleteHolding } from "@/hooks/useDeleteHolding";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PercentBadge } from "@/components/shared/PercentBadge";
import { formatCurrency, formatQuantity } from "@/lib/utils/format";
import { FIXED_INCOME_INDEX_LABELS } from "@/lib/utils/constants";
import type { PortfolioAsset } from "@/types/portfolio";
import type { AssetType } from "@/types/database";

interface PortfolioTableProps {
  assets: PortfolioAsset[];
}

const FII_TYPES: AssetType[] = ["br_fii"];

const CATEGORY_ORDER: { key: string; label: string; types: AssetType[] }[] = [
  { key: "acoes_br", label: "Acoes BR", types: ["br_stock"] },
  { key: "fiis", label: "FIIs", types: ["br_fii"] },
  { key: "etfs_br", label: "ETFs BR", types: ["br_etf"] },
  { key: "bdrs", label: "BDRs", types: ["br_bdr"] },
  { key: "acoes_us", label: "Acoes US", types: ["us_stock"] },
  { key: "etfs_us", label: "ETFs US", types: ["us_etf"] },
  { key: "crypto", label: "Criptomoedas", types: ["crypto"] },
  { key: "fixed", label: "Renda Fixa", types: ["fixed_income"] },
  { key: "funds", label: "Fundos", types: ["fund"] },
];

function getPriceColor(asset: PortfolioAsset): string {
  if (!asset.currentPrice || asset.totalInvested === 0 || asset.assetType === "fixed_income") {
    return "";
  }
  const diff = asset.currentPrice - asset.averagePrice;
  if (Math.abs(diff) < 0.01) return "text-muted-foreground";
  return diff > 0 ? "text-emerald-600" : "text-red-600";
}

function isFII(asset: PortfolioAsset): boolean {
  return FII_TYPES.includes(asset.assetType);
}

function getCategoryProfitLossPercent(catAssets: PortfolioAsset[]): number | null {
  let totalInvested = 0;
  let totalProfitLoss = 0;
  let hasValue = false;

  for (const a of catAssets) {
    if (a.totalInvested > 0 && a.profitLoss !== null) {
      totalInvested += a.totalInvested;
      totalProfitLoss += a.profitLoss;
      hasValue = true;
    }
  }

  if (!hasValue || totalInvested === 0) return null;
  return (totalProfitLoss / totalInvested) * 100;
}

interface CategoryGroup {
  key: string;
  label: string;
  assets: PortfolioAsset[];
}

interface BrokerGroup {
  brokerId: string;
  brokerName: string;
  categories: CategoryGroup[];
}

export function PortfolioTable({ assets }: PortfolioTableProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // collapsedCategories uses "brokerId::catKey" as key
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  // Group assets by broker first, then by category within each broker
  const brokerGroups = useMemo(() => {
    const brokerMap = new Map<string, { brokerId: string; brokerName: string; assets: PortfolioAsset[] }>();

    for (const asset of assets) {
      if (!brokerMap.has(asset.brokerId)) {
        brokerMap.set(asset.brokerId, { brokerId: asset.brokerId, brokerName: asset.brokerName, assets: [] });
      }
      brokerMap.get(asset.brokerId)!.assets.push(asset);
    }

    const result: BrokerGroup[] = [];

    for (const broker of brokerMap.values()) {
      const categories: CategoryGroup[] = [];

      for (const cat of CATEGORY_ORDER) {
        const catAssets = broker.assets.filter((a) => cat.types.includes(a.assetType));
        if (catAssets.length === 0) continue;
        categories.push({ key: cat.key, label: cat.label, assets: catAssets });
      }

      if (categories.length > 0) {
        result.push({ brokerId: broker.brokerId, brokerName: broker.brokerName, categories });
      }
    }

    return result;
  }, [assets]);

  // Initialize all categories as collapsed on first render
  if (!initialized && brokerGroups.length > 0) {
    const allKeys = new Set<string>();
    for (const broker of brokerGroups) {
      for (const cat of broker.categories) {
        allKeys.add(`${broker.brokerId}::${cat.key}`);
      }
    }
    setCollapsedCategories(allKeys);
    setInitialized(true);
  }

  if (assets.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border text-muted-foreground">
        Nenhum investimento encontrado. Adicione uma transacao para comecar!
      </div>
    );
  }

  function toggleExpanded(holdingId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(holdingId)) next.delete(holdingId);
      else next.add(holdingId);
      return next;
    });
  }

  function toggleCategory(compositeKey: string) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(compositeKey)) next.delete(compositeKey);
      else next.add(compositeKey);
      return next;
    });
  }

  function getEffectiveDividends(asset: PortfolioAsset): number {
    return asset.manualOverrides?.dividendsAccumulated ?? asset.dividendsAccumulated;
  }

  function getEffectiveRentProv(asset: PortfolioAsset): number | null {
    if (asset.manualOverrides?.rentComProventos != null) return asset.manualOverrides.rentComProventos;
    if (asset.profitLoss === null || asset.totalInvested === 0) return null;
    return ((asset.profitLoss + asset.dividendsAccumulated) / asset.totalInvested) * 100;
  }

  function getEffectiveRentBruta(asset: PortfolioAsset): number | null {
    if (asset.manualOverrides?.rentBruta != null) return asset.manualOverrides.rentBruta;
    if (asset.profitLoss === null || asset.totalInvested === 0) return null;
    return ((asset.profitLoss + asset.dividendsAccumulated) / asset.totalInvested) * 100;
  }

  const colCount = 7;
  const multipleBrokers = brokerGroups.length > 1;

  return (
    <div className="space-y-6">
      {brokerGroups.map((broker) => (
        <div key={broker.brokerId}>
          {/* Broker header — only show if multiple brokers */}
          {multipleBrokers && (
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">{broker.brokerName}</h3>
          )}

          <div className="space-y-3">
            {broker.categories.map((cat) => {
              const compositeKey = `${broker.brokerId}::${cat.key}`;
              const isCatCollapsed = collapsedCategories.has(compositeKey);
              const catProfitPercent = getCategoryProfitLossPercent(cat.assets);

              return (
                <div key={cat.key} className="rounded-lg border overflow-hidden">
                  {/* Category toggle header */}
                  <button
                    type="button"
                    className="flex w-full items-center justify-between bg-muted/50 px-4 py-3 hover:bg-muted/70 transition-colors"
                    onClick={() => toggleCategory(compositeKey)}
                  >
                    <div className="flex items-center gap-2">
                      {isCatCollapsed ? (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-sm font-semibold">{cat.label}</span>
                      <span className="text-xs text-muted-foreground">({cat.assets.length})</span>
                    </div>
                    <PercentBadge value={catProfitPercent} />
                  </button>

                  {/* Category content — collapsible */}
                  {!isCatCollapsed && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8"></TableHead>
                          <TableHead>Ativo</TableHead>
                          <TableHead className="text-right">Qtd</TableHead>
                          <TableHead className="text-right hidden lg:table-cell">P. Medio</TableHead>
                          <TableHead className="text-right">P. Atual</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="text-right">Lucro/Perda</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cat.assets.map((asset) => {
                          const isExpanded = expandedIds.has(asset.holdingId);
                          const priceColor = getPriceColor(asset);

                          return (
                            <Fragment key={asset.holdingId}>
                              <TableRow
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => toggleExpanded(asset.holdingId)}
                              >
                                <TableCell className="w-8 px-2">
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Link
                                    href={`/asset/${asset.ticker}`}
                                    className="font-medium hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {asset.ticker}
                                  </Link>
                                  <div className="text-xs text-muted-foreground">{asset.name}</div>
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  {asset.assetType === "fixed_income"
                                    ? "--"
                                    : formatQuantity(asset.totalQuantity)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm hidden lg:table-cell">
                                  {asset.totalInvested === 0
                                    ? "--"
                                    : formatCurrency(
                                        asset.assetType === "fixed_income" ? asset.totalInvested : asset.averagePrice,
                                        asset.currency
                                      )}
                                </TableCell>
                                <TableCell className={`text-right font-mono text-sm ${priceColor}`}>
                                  {asset.assetType === "fixed_income" && asset.fixedIncomeIndex
                                    ? `${FIXED_INCOME_INDEX_LABELS[asset.fixedIncomeIndex] || asset.fixedIncomeIndex} ${asset.fixedIncomeRate ?? ""}%`
                                    : asset.currentPrice
                                      ? formatCurrency(asset.currentPrice, asset.currency)
                                      : "--"}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  {asset.currentValue
                                    ? formatCurrency(asset.currentValue, asset.currency)
                                    : "--"}
                                </TableCell>
                                <TableCell className="text-right">
                                  {asset.totalInvested === 0 ? (
                                    <span className="font-mono text-sm text-muted-foreground">--</span>
                                  ) : (
                                    <div className="flex flex-col items-end gap-1">
                                      <span
                                        className={`font-mono text-sm ${
                                          Math.abs(asset.profitLoss ?? 0) < 0.01
                                            ? "text-muted-foreground"
                                            : (asset.profitLoss ?? 0) > 0
                                              ? "text-emerald-600"
                                              : "text-red-600"
                                        }`}
                                      >
                                        {asset.profitLoss !== null
                                          ? formatCurrency(asset.profitLoss, asset.currency)
                                          : "--"}
                                      </span>
                                      <PercentBadge value={asset.profitLossPercent} />
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>

                              {/* Expanded details — adapts by asset type */}
                              {isExpanded && (
                                <TableRow className="bg-muted/30 hover:bg-muted/30">
                                  <TableCell colSpan={colCount} className="p-0">
                                    {isFII(asset) ? (
                                      <FIIExpandedDetails asset={asset} getEffectiveDividends={getEffectiveDividends} getEffectiveRentProv={getEffectiveRentProv} getEffectiveRentBruta={getEffectiveRentBruta} />
                                    ) : (
                                      <StockExpandedDetails asset={asset} />
                                    )}
                                    <DeleteHoldingButton holdingId={asset.holdingId} ticker={asset.ticker} />
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// FII expanded: Total Investido, Proventos, Rent. c/ Prov., Rent. Bruta
function FIIExpandedDetails({
  asset,
  getEffectiveDividends,
  getEffectiveRentProv,
  getEffectiveRentBruta,
}: {
  asset: PortfolioAsset;
  getEffectiveDividends: (a: PortfolioAsset) => number;
  getEffectiveRentProv: (a: PortfolioAsset) => number | null;
  getEffectiveRentBruta: (a: PortfolioAsset) => number | null;
}) {
  const effectiveDividends = getEffectiveDividends(asset);
  const effectiveRentProv = getEffectiveRentProv(asset);
  const effectiveRentBruta = getEffectiveRentBruta(asset);

  return (
    <div className="grid grid-cols-2 gap-4 px-6 py-4 sm:grid-cols-4">
      <div>
        <div className="text-xs text-muted-foreground">Total Investido</div>
        <div className="text-sm font-mono">
          {asset.totalInvested === 0
            ? "--"
            : formatCurrency(asset.totalInvested, asset.currency)}
        </div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">Proventos</div>
        <div className={`text-sm font-mono ${effectiveDividends > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
          {effectiveDividends > 0
            ? formatCurrency(effectiveDividends, asset.currency)
            : "--"}
        </div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">Rent. c/ Prov.</div>
        <div className="text-sm">
          {asset.totalInvested === 0 ? (
            <span className="font-mono text-muted-foreground">--</span>
          ) : (
            <PercentBadge value={effectiveRentProv} />
          )}
        </div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">Rent. Bruta</div>
        <div className="text-sm">
          {asset.totalInvested === 0 ? (
            <span className="font-mono text-muted-foreground">--</span>
          ) : (
            <PercentBadge value={effectiveRentBruta} />
          )}
        </div>
      </div>
    </div>
  );
}

// Stock/ETF/BDR/Crypto expanded: Total Investido, Dividendos, Retorno Total
function StockExpandedDetails({ asset }: { asset: PortfolioAsset }) {
  const dividends = asset.dividendsAccumulated || 0;
  const capitalGain = asset.profitLoss ?? 0;
  const totalReturn = capitalGain + dividends;
  const totalReturnPercent = asset.totalInvested > 0
    ? (totalReturn / asset.totalInvested) * 100
    : null;
  const currLabel = asset.currency === "USD" ? "US$" : "R$";
  const hasDividends = dividends > 0;

  return (
    <div className={`grid gap-4 px-6 py-4 ${hasDividends ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
      <div>
        <div className="text-xs text-muted-foreground">Total Investido</div>
        <div className="text-sm font-mono">
          {asset.totalInvested === 0
            ? "--"
            : formatCurrency(asset.totalInvested, asset.currency)}
        </div>
      </div>
      {hasDividends && (
        <div>
          <div className="text-xs text-muted-foreground">Dividendos</div>
          <div className="text-sm font-mono text-emerald-600">
            {formatCurrency(dividends, asset.currency)}
          </div>
        </div>
      )}
      <div>
        <div className="text-xs text-muted-foreground">
          {hasDividends ? "Retorno Total" : "Rentabilidade"}
        </div>
        <div className="text-sm">
          {asset.totalInvested === 0 ? (
            <span className="font-mono text-muted-foreground">--</span>
          ) : (
            <PercentBadge value={hasDividends ? totalReturnPercent : asset.profitLossPercent} />
          )}
        </div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">
          {hasDividends ? `Retorno Total (${currLabel})` : `Rentabilidade (${currLabel})`}
        </div>
        <div className="text-sm">
          {asset.profitLoss === null || asset.totalInvested === 0 ? (
            <span className="font-mono text-muted-foreground">--</span>
          ) : (
            <span
              className={`font-mono ${
                Math.abs(hasDividends ? totalReturn : capitalGain) < 0.01
                  ? "text-muted-foreground"
                  : (hasDividends ? totalReturn : capitalGain) > 0
                    ? "text-emerald-600"
                    : "text-red-600"
              }`}
            >
              {formatCurrency(hasDividends ? totalReturn : capitalGain, asset.currency)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Botao de deletar holding com confirmacao
function DeleteHoldingButton({ holdingId, ticker }: { holdingId: string; ticker: string }) {
  const [confirming, setConfirming] = useState(false);
  const deleteHolding = useDeleteHolding();

  const handleDelete = async () => {
    await deleteHolding.mutateAsync(holdingId);
    setConfirming(false);
  };

  return (
    <div className="flex items-center justify-end gap-2 px-6 pb-3">
      {confirming ? (
        <>
          <span className="text-xs text-muted-foreground">
            Deletar {ticker} e todas as transacoes?
          </span>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteHolding.isPending}
          >
            {deleteHolding.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Confirmar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirming(false)}
          >
            Cancelar
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => setConfirming(true)}
        >
          <Trash2 className="mr-1 h-3 w-3" />
          Deletar
        </Button>
      )}
    </div>
  );
}
