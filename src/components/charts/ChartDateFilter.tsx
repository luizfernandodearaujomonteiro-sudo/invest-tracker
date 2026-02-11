"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DATE_RANGE_OPTIONS } from "@/lib/utils/constants";
import type { DateRange } from "@/types/portfolio";

interface ChartDateFilterProps {
  selected: DateRange;
  onChange: (range: DateRange) => void;
}

export function ChartDateFilter({ selected, onChange }: ChartDateFilterProps) {
  return (
    <div className="flex gap-1">
      {DATE_RANGE_OPTIONS.map((option) => (
        <Button
          key={option.value}
          variant={selected === option.value ? "default" : "ghost"}
          size="sm"
          className={cn(
            "h-7 px-2.5 text-xs",
            selected === option.value && "font-semibold"
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
