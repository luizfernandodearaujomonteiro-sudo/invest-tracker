"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import type { PortfolioSummary } from "@/types/portfolio";

interface PortfolioSummaryCardsProps {
  summary: PortfolioSummary;
}

export function PortfolioSummaryCards({ summary }: PortfolioSummaryCardsProps) {
  const cards = [
    {
      title: "Valor Total",
      value: formatCurrency(summary.totalValue),
      description: `${summary.assetCount} ativos`,
      icon: Wallet,
      color: "text-blue-600",
    },
    {
      title: "Total Investido",
      value: formatCurrency(summary.totalInvested),
      description: "Custo total dos aportes",
      icon: DollarSign,
      color: "text-slate-600",
    },
    {
      title: "Lucro / Perda",
      value: formatCurrency(summary.totalProfitLoss),
      description: formatPercent(summary.totalProfitLossPercent),
      icon: summary.totalProfitLoss >= 0 ? TrendingUp : TrendingDown,
      color:
        summary.totalProfitLoss >= 0 ? "text-emerald-600" : "text-red-600",
    },
    {
      title: "Variacao do Dia",
      value: formatCurrency(summary.dayChange),
      description: formatPercent(summary.dayChangePercent),
      icon: summary.dayChange >= 0 ? TrendingUp : TrendingDown,
      color: summary.dayChange >= 0 ? "text-emerald-600" : "text-red-600",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className={cn("h-4 w-4", card.color)} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p
              className={cn(
                "text-xs",
                card.title === "Lucro / Perda" || card.title === "Variacao do Dia"
                  ? card.color
                  : "text-muted-foreground"
              )}
            >
              {card.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
