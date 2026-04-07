import { CHART_COLORS } from "@/config/constants/chart.constant";
import React, { useMemo } from "react";
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ValueType } from "recharts/types/component/DefaultTooltipContent";

export interface IBarChartData {
  label: string;
  value: number;
  valueLabel?: string;
}

interface HorizontalBarChartProps {
  data: IBarChartData[];
  loading?: boolean;
  errorMessage?: string | null;
  tooltipValueFormatter?: (value: number | string | undefined | ValueType) => string;
  maxItems?: number;
}

export default function HorizontalBarChart({
  data: _data,
  loading,
  errorMessage,
  tooltipValueFormatter,
  maxItems = 10,
}: HorizontalBarChartProps) {
  const data = useMemo(() => {
    return _data.slice(0, maxItems).map((item, index) => ({
      ...item,
      fill: CHART_COLORS[index % CHART_COLORS.length],
    }));
  }, [_data, maxItems]);

  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[200px]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
        {errorMessage}
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {data.map((item, index) => {
        const percentage = total > 0 ? (item.value / total) * 100 : 0;
        const displayValue = tooltipValueFormatter
          ? tooltipValueFormatter(item.value)
          : item.valueLabel || item.value.toLocaleString();

        return (
          <div key={item.label} className="group">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-foreground truncate max-w-[60%]" title={item.label}>
                {item.label}
              </span>
              <span className="text-muted-foreground tabular-nums font-mono text-xs">
                {displayValue}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${Math.max(percentage, 1)}%`,
                  backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                  opacity: 0.85,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
