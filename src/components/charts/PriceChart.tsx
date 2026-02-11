"use client";

import { useEffect, useRef } from "react";
import { createChart, ColorType, AreaSeries, type IChartApi } from "lightweight-charts";
import type { HistoricalPrice } from "@/types/portfolio";

interface PriceChartProps {
  data: HistoricalPrice[];
  height?: number;
}

export function PriceChart({ data, height = 400 }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    // Clean up previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9ca3af",
      },
      grid: {
        vertLines: { color: "rgba(156, 163, 175, 0.1)" },
        horzLines: { color: "rgba(156, 163, 175, 0.1)" },
      },
      crosshair: {
        mode: 0,
      },
      rightPriceScale: {
        borderColor: "rgba(156, 163, 175, 0.2)",
      },
      timeScale: {
        borderColor: "rgba(156, 163, 175, 0.2)",
        timeVisible: false,
      },
    });

    const isPositive =
      data.length >= 2
        ? data[data.length - 1].close >= data[0].close
        : true;

    const lineColor = isPositive ? "#10b981" : "#ef4444";
    const areaTopColor = isPositive
      ? "rgba(16, 185, 129, 0.3)"
      : "rgba(239, 68, 68, 0.3)";
    const areaBottomColor = isPositive
      ? "rgba(16, 185, 129, 0.01)"
      : "rgba(239, 68, 68, 0.01)";

    const series = chart.addSeries(AreaSeries, {
      lineColor,
      topColor: areaTopColor,
      bottomColor: areaBottomColor,
      lineWidth: 2,
    });

    const chartData = data
      .filter((d) => d.close !== null && d.date)
      .map((d) => ({
        time: d.date as string,
        value: d.close,
      }));

    series.setData(chartData);
    chart.timeScale().fitContent();
    chartRef.current = chart;

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [data, height]);

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground"
        style={{ height }}
      >
        Sem dados de historico para este periodo
      </div>
    );
  }

  return <div ref={containerRef} className="w-full" />;
}
