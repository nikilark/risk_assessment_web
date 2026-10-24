import * as echarts from "echarts";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { formatNumber } from "../domain/risk";
import type { ResultItem } from "../domain/types";

export interface ChartPanelHandle {
  toPng: () => string | undefined;
}

function wrapChartLabel(value: string, maxLineLength = 18, maxLines = 4): string {
  const words = value
    .replace(/\s+·\s+/g, " · ")
    .split(/\s+/)
    .filter(Boolean);
  const lines: string[] = [];
  let current = "";

  const pushLongWord = (word: string) => {
    let rest = word;
    while (rest.length > maxLineLength && lines.length < maxLines) {
      lines.push(rest.slice(0, maxLineLength));
      rest = rest.slice(maxLineLength);
    }
    current = rest;
  };

  for (const word of words) {
    if (word.length > maxLineLength) {
      if (current) {
        lines.push(current);
        current = "";
      }
      pushLongWord(word);
      continue;
    }
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxLineLength) {
      current = next;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (!lines.length) return value;
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, Math.max(1, maxLineLength - 1))}…`;
  }
  return lines.join("\n");
}

export const ChartPanel = forwardRef<ChartPanelHandle, { result: ResultItem }>(function ChartPanel({ result }, handleRef) {
  const ref = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.EChartsType | null>(null);

  useImperativeHandle(handleRef, () => ({
    toPng: () => chartRef.current?.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#ffffff" })
  }), []);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    chartRef.current = chart;
    const categories = result.chartCategories ?? [...new Set(result.chartSeries.map((item) => item.label))];
    const seriesNames = [...new Set(result.chartSeries.map((item) => item.series ?? result.chartLabel))];
    const wrappedLabels = categories.map((item) => wrapChartLabel(item));
    const maxLabelLines = Math.max(1, ...wrappedLabels.map((label) => label.split("\n").length));
    chart.setOption({
      grid: { left: 64, right: 24, top: seriesNames.length > 1 ? 64 : 36, bottom: Math.min(150, 68 + maxLabelLines * 18) },
      legend: seriesNames.length > 1 ? { type: "scroll", top: 4 } : undefined,
      tooltip: {
        trigger: "axis",
        valueFormatter: (value: unknown) => typeof value === "number" ? formatNumber(value) : String(value)
      },
      xAxis: {
        type: "category",
        axisLabel: {
          interval: 0,
          lineHeight: 15,
          margin: 12,
          formatter: (value: string) => wrapChartLabel(value),
          hideOverlap: true
        },
        data: categories
      },
      yAxis: {
        type: "value",
        name: result.chartLabel,
        axisLabel: { formatter: (value: number) => formatNumber(value) }
      },
      dataZoom: categories.length > 12 ? [{ type: "slider", bottom: 0, start: 0, end: Math.min(100, 12 / categories.length * 100) }] : undefined,
      series: seriesNames.map((name) => ({
        name, type: result.chartType ?? "bar", connectNulls: false,
        data: categories.map((label) => result.chartSeries.find((item) => item.label === label && (item.series ?? result.chartLabel) === name)?.value ?? null),
        itemStyle: { borderRadius: [4, 4, 0, 0] }
      }))
    });
    const resize = () => chart.resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      chart.dispose();
      chartRef.current = null;
    };
  }, [result]);

  return <div className="chart-panel" ref={ref} role="img" aria-label={result.title} />;
});
