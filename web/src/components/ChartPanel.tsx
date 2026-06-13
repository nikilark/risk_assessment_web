import * as echarts from "echarts";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
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
    const wrappedLabels = result.chartSeries.map((item) => wrapChartLabel(item.label));
    const maxLabelLines = Math.max(1, ...wrappedLabels.map((label) => label.split("\n").length));
    chart.setOption({
      grid: { left: 64, right: 24, top: 36, bottom: Math.min(150, 68 + maxLabelLines * 18) },
      tooltip: { trigger: "axis" },
      xAxis: {
        type: "category",
        axisLabel: {
          interval: 0,
          lineHeight: 15,
          margin: 12,
          formatter: (value: string) => wrapChartLabel(value),
          hideOverlap: true
        },
        data: result.chartSeries.map((item) => item.label)
      },
      yAxis: { type: "value", name: result.chartLabel },
      series: [
        {
          type: "bar",
          data: result.chartSeries.map((item) => item.value),
          itemStyle: { color: "#b68b3f", borderRadius: [4, 4, 0, 0] }
        }
      ]
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
