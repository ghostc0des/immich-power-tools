import { Card } from "@/components/ui/card";
import HorizontalBarChart from "@/components/ui/horizontal-bar-chart";
import { IBarChartData } from "@/components/ui/horizontal-bar-chart";
import { getExifDistribution, ISupportedEXIFColumns } from "@/handlers/api/analytics.handler";
import React, { useEffect, useState } from "react";
import { ValueType } from "recharts/types/component/DefaultTooltipContent";

export interface IEXIFDistributionProps {
  column: ISupportedEXIFColumns;
  title: string;
  description: string;
  tooltipValueFormatter?: (value?: number | string | undefined | ValueType) => string;
}

export default function EXIFDistribution(
  { column, title, description, tooltipValueFormatter }: IEXIFDistributionProps
) {
  const [chartData, setChartData] = useState<IBarChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getExifDistribution(column);
      setChartData(data);
    } catch (error: any) {
      setErrorMessage(error?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [column]);

  return (
    <Card title={title} description={description}>
      <HorizontalBarChart
        data={chartData}
        loading={loading}
        errorMessage={errorMessage}
        tooltipValueFormatter={tooltipValueFormatter}
      />
    </Card>
  );
}
