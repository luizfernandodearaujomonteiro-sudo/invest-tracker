"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PercentBadge } from "@/components/shared/PercentBadge";
import { formatCurrency, formatQuantity } from "@/lib/utils/format";
import { ASSET_TYPE_LABELS, FIXED_INCOME_INDEX_LABELS } from "@/lib/utils/constants";
import { PriceAdjustDialog } from "./PriceAdjustDialog";
import type { PortfolioAsset } from "@/types/portfolio";

interface PortfolioTableProps {
  assets: PortfolioAsset[];
}

export function PortfolioTable({ assets }: PortfolioTableProps) {
  const [editingAsset, setEditingAsset] = useState<PortfolioAsset | null>(null);

  if (assets.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border text-muted-foreground">
        Nenhum investimento encontrado. Adicione uma transacao para comecar!
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ativo</TableHead>
              <TableHead className="hidden md:table-cell">Tipo</TableHead>
              <TableHead className="hidden sm:table-cell">Corretora</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead className="text-right hidden lg:table-cell">
                Preco Medio
              </TableHead>
              <TableHead className="text-right">Preco Atual</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Lucro/Perda</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.map((asset) => (
              <TableRow key={asset.holdingId} className="cursor-pointer">
                <TableCell>
                  <Link
                    href={`/asset/${asset.ticker}`}
                    className="font-medium hover:underline"
                  >
                    {asset.ticker}
                  </Link>
                  <div className="text-xs text-muted-foreground">{asset.name}</div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge variant="secondary" className="text-xs">
                    {ASSET_TYPE_LABELS[asset.assetType]}
                  </Badge>
                </TableCell>
                <TableCell className="hidden sm:table-cell text-sm">
                  {asset.brokerName}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {asset.assetType === "fixed_income"
                    ? "--"
                    : formatQuantity(asset.totalQuantity)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm hidden lg:table-cell">
                  <div className="flex items-center justify-end gap-1">
                    {asset.totalInvested === 0
                      ? "--"
                      : formatCurrency(asset.assetType === "fixed_income" ? asset.totalInvested : asset.averagePrice, asset.currency)}
                    {asset.assetType !== "fixed_income" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingAsset(asset);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
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
                          (asset.profitLoss ?? 0) >= 0
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
            ))}
          </TableBody>
        </Table>
      </div>

      {editingAsset && (
        <PriceAdjustDialog
          open={!!editingAsset}
          onOpenChange={(open) => {
            if (!open) setEditingAsset(null);
          }}
          holdingId={editingAsset.holdingId}
          ticker={editingAsset.ticker}
          currentAvgPrice={editingAsset.averagePrice}
          currency={editingAsset.currency}
          adjustments={editingAsset.priceAdjustments}
        />
      )}
    </>
  );
}
