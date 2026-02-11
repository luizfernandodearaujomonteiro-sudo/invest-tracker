"use client";

import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/utils/format";

interface PercentBadgeProps {
  value: number | null;
  className?: string;
}

export function PercentBadge({ value, className }: PercentBadgeProps) {
  if (value === null || value === undefined) {
    return (
      <Badge variant="secondary" className={cn("gap-1", className)}>
        <Minus className="h-3 w-3" />
        --
      </Badge>
    );
  }

  const isPositive = value > 0;
  const isNeutral = value === 0;

  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1",
        isPositive && "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
        !isPositive && !isNeutral && "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
        className
      )}
    >
      {isPositive ? (
        <TrendingUp className="h-3 w-3" />
      ) : isNeutral ? (
        <Minus className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {formatPercent(value)}
    </Badge>
  );
}
