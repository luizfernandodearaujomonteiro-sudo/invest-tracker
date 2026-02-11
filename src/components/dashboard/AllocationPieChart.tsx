"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ASSET_TYPE_LABELS, ASSET_TYPE_COLORS } from "@/lib/utils/constants";
import { formatCurrency } from "@/lib/utils/format";
import type { PortfolioAsset } from "@/types/portfolio";
import type { AssetType } from "@/types/database";

interface AllocationPieChartProps {
  assets: PortfolioAsset[];
  groupBy?: "type" | "broker";
}

export function AllocationPieChart({
  assets,
  groupBy = "type",
}: AllocationPieChartProps) {
  const grouped = assets.reduce(
    (acc, asset) => {
      const key =
        groupBy === "type"
          ? ASSET_TYPE_LABELS[asset.assetType]
          : asset.brokerName;
      const value = asset.currentValue ?? asset.totalInvested;
      acc[key] = (acc[key] || 0) + value;
      return acc;
    },
    {} as Record<string, number>
  );

  const total = Object.values(grouped).reduce((a, b) => a + b, 0);

  const data = Object.entries(grouped)
    .map(([name, value]) => ({
      name,
      value,
      percent: total > 0 ? (value / total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const COLORS =
    groupBy === "type"
      ? Object.values(ASSET_TYPE_COLORS)
      : [
          "#2563eb",
          "#7c3aed",
          "#0891b2",
          "#059669",
          "#dc2626",
          "#ea580c",
          "#f59e0b",
          "#64748b",
        ];

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {groupBy === "type" ? "Alocacao por Tipo" : "Alocacao por Corretora"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-[250px] items-center justify-center text-muted-foreground">
          Nenhum investimento registrado
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {groupBy === "type" ? "Alocacao por Tipo" : "Alocacao por Corretora"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatCurrency(Number(value))}
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
              }}
            />
            <Legend
              formatter={(value) => {
                const item = data.find((d) => d.name === value);
                return `${value} (${item?.percent.toFixed(1)}%)`;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
