import * as echarts from "echarts";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { formatNumber } from "../domain/risk";
import type { ResultItem } from "../domain/types";

export interface ChartPanelHandle {
  toPng: () => string | undefined;
}

const lightPalette = {
  background: "#ffffff", surface: "#ffffff", text: "#1b1d22", muted: "#69717f", line: "#d9d3c7",
  series: ["#2864b4", "#16845b", "#b26a00", "#aa3c70", "#6a55b8", "#00828a"]
};

function chartPalette(container: HTMLDivElement) {
  const style = getComputedStyle(container);
  const dark = document.documentElement.dataset.theme === "dark" && !container.closest(".report-sheet");
  return {
    background: style.backgroundColor,
    surface: style.getPropertyValue("--panel-strong").trim(),
    text: style.color,
    muted: style.getPropertyValue("--muted").trim(),
    line: style.getPropertyValue("--line").trim(),
    series: dark ? ["#82b7ff", "#8ad4a5", "#f2c66d", "#eda0bf", "#b7a5ff", "#7bd5dc"] : lightPalette.series
  };
}

function applyPalette(chart: echarts.EChartsType, palette: typeof lightPalette) {
  const hasZoom = (chart.getOption().dataZoom as unknown[] | undefined)?.length;
  chart.setOption({
    backgroundColor: palette.background,
    color: palette.series,
    textStyle: { color: palette.text },
    legend: {
      textStyle: { color: palette.text }, inactiveColor: palette.muted,
      pageTextStyle: { color: palette.text }, pageIconColor: palette.text, pageIconInactiveColor: palette.line
    },
    tooltip: { backgroundColor: palette.surface, borderColor: palette.line, textStyle: { color: palette.text } },
    xAxis: {
      axisLabel: { color: palette.text }, axisLine: { lineStyle: { color: palette.muted } },
      axisTick: { lineStyle: { color: palette.muted } },
      axisPointer: { label: { backgroundColor: palette.text, color: palette.background } }
    },
    yAxis: {
      axisLabel: { color: palette.text }, nameTextStyle: { color: palette.text },
      axisLine: { lineStyle: { color: palette.muted } }, splitLine: { lineStyle: { color: palette.line } }
    },
    dataZoom: hasZoom ? {
      textStyle: { color: palette.text }, borderColor: palette.line, backgroundColor: palette.surface,
      fillerColor: "rgba(105, 145, 195, 0.25)", handleStyle: { color: palette.muted, borderColor: palette.background },
      moveHandleStyle: { color: palette.muted },
      dataBackground: { lineStyle: { color: palette.muted }, areaStyle: { color: palette.line } },
      selectedDataBackground: { lineStyle: { color: palette.text }, areaStyle: { color: palette.muted } }
    } : []
  });
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
    toPng: () => {
      const chart = chartRef.current;
      const container = ref.current;
      if (!chart || !container) return undefined;
      applyPalette(chart, lightPalette);
      try {
        return chart.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#ffffff" });
      } finally {
        applyPalette(chart, chartPalette(container));
      }
    }
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
      legend: { show: seriesNames.length > 1, type: "scroll", top: 4 },
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
    const updatePalette = () => {
      if (ref.current) applyPalette(chart, chartPalette(ref.current));
    };
    updatePalette();
    const themeObserver = new MutationObserver(updatePalette);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "style"] });
    const resize = () => chart.resize();
    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(ref.current);
    window.addEventListener("resize", resize);
    return () => {
      themeObserver.disconnect();
      sizeObserver.disconnect();
      window.removeEventListener("resize", resize);
      chart.dispose();
      chartRef.current = null;
    };
  }, [result]);

  return <div className="chart-panel" ref={ref} role="img" aria-label={result.title} />;
});
