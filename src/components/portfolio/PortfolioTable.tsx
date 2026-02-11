"use client";

import Link from "next/link";
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
import { ASSET_TYPE_LABELS } from "@/lib/utils/constants";
import type { PortfolioAsset } from "@/types/portfolio";

interface PortfolioTableProps {
  assets: PortfolioAsset[];
}

export function PortfolioTable({ assets }: PortfolioTableProps) {
  if (assets.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border text-muted-foreground">
        Nenhum investimento encontrado. Adicione uma transacao para comecar!
      </div>
    );
  }

  return (
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
                {formatQuantity(asset.totalQuantity)}
              </TableCell>
              <TableCell className="text-right font-mono text-sm hidden lg:table-cell">
                {formatCurrency(asset.averagePrice, asset.currency)}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {asset.currentPrice
                  ? formatCurrency(asset.currentPrice, asset.currency)
                  : "--"}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {asset.currentValue
                  ? formatCurrency(asset.currentValue, asset.currency)
                  : "--"}
              </TableCell>
              <TableCell className="text-right">
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
