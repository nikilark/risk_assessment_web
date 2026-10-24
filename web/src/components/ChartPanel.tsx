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
    title: { textStyle: { color: palette.text }, subtextStyle: { color: palette.muted } },
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

function chartHeading(result: ResultItem, width: number) {
  const text = wrapChartLabel(`${result.title} (${result.chartLabel})`, Math.max(24, Math.floor((width - 32) / 8)), 10);
  const names = [...new Set(result.chartSeries.map((item) => item.series ?? result.chartLabel))];
  const subtext = [result.years?.length ? `Роки: ${result.years.join(", ")}` : "",
    result.chartType === "line" && names.length === 1 ? names[0] : ""].filter(Boolean).join(" · ");
  const wrappedYears = wrapChartLabel(subtext, Math.max(28, Math.floor((width - 32) / 7)), 10);
  const height = 18 + text.split("\n").length * 19 + (wrappedYears ? wrappedYears.split("\n").length * 16 + 10 : 0);
  return {
    height,
    title: { text, subtext: wrappedYears, left: 12, top: 10,
      textStyle: { fontSize: 14, lineHeight: 19 }, subtextStyle: { fontSize: 12, lineHeight: 16 }, itemGap: 6 }
  };
}

function chartLayout(result: ResultItem, width: number, height: number, exporting = false) {
  const categories = result.chartCategories ?? [...new Set(result.chartSeries.map((item) => item.label))];
  const names = [...new Set(result.chartSeries.map((item) => item.series ?? result.chartLabel))];
  const heading = chartHeading(result, width);
  const labelLines = Math.max(1, ...categories.map((label) => wrapChartLabel(label).split("\n").length));
  const bottom = Math.min(150, 68 + labelLines * 18);
  const hasLegend = names.length > 1;
  const tendency = result.chartType === "line" && hasLegend;
  const sideLegend = tendency && width >= 720 && !exporting;
  const legendWidth = sideLegend ? Math.min(320, Math.floor(width * 0.38)) : width - 32;
  const legendTop = exporting ? height - exportLegendHeight(result, width) : sideLegend ? heading.height + 12 : tendency ? height - 180 : heading.height + 8;
  const textWidth = exporting ? exportLegendTextWidth(width) : sideLegend ? legendWidth - 46 : tendency ? width - 78 : undefined;
  return {
    title: heading.title,
    grid: {
      left: 64, right: sideLegend ? legendWidth + 24 : 24,
      top: heading.height + (hasLegend && !tendency && !exporting ? 54 : 30),
      bottom: exporting && hasLegend ? exportLegendHeight(result, width) + bottom : tendency && !sideLegend ? 180 + bottom : bottom
    },
    legend: {
      show: hasLegend, data: names, type: exporting ? "plain" : "scroll",
      orient: tendency && !exporting ? "vertical" : "horizontal",
      left: sideLegend ? width - legendWidth : 16, top: legendTop,
      width: legendWidth, height: exporting ? exportLegendHeight(result, width) - 12 : tendency ? Math.max(60, height - legendTop - 14) : 40,
      itemGap: 12, itemWidth: 18, itemHeight: 10,
      textStyle: { fontSize: 12, lineHeight: 15, ...(textWidth ? { width: textWidth } : {}) },
      formatter: (name: string) => textWidth ? wrapChartLabel(name, Math.max(12, Math.floor(textWidth / 7)), exporting ? 100 : 3) : name,
      tooltip: { show: true }, pageButtonPosition: "end"
    },
    dataZoom: categories.length > 12 ? [{ type: "slider", bottom: exporting && hasLegend ? exportLegendHeight(result, width) : tendency && !sideLegend ? 180 : 0 }] : []
  };
}

function exportLegendTextWidth(width: number) {
  const columns = Math.max(1, Math.floor((width - 32) / 350));
  return Math.floor((width - 32) / columns) - 52;
}

function exportLegendHeight(result: ResultItem, width: number) {
  const names = [...new Set(result.chartSeries.map((item) => item.series ?? result.chartLabel))];
  if (names.length < 2) return 0;
  const columns = Math.max(1, Math.floor((width - 32) / 350));
  const characters = Math.max(12, Math.floor(exportLegendTextWidth(width) / 7));
  const lines = Math.max(...names.map((name) => wrapChartLabel(name, characters, 100).split("\n").length));
  return Math.ceil(names.length / columns) * (lines * 15 + 12) + 24;
}

export const ChartPanel = forwardRef<ChartPanelHandle, { result: ResultItem }>(function ChartPanel({ result }, handleRef) {
  const ref = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.EChartsType | null>(null);

  useImperativeHandle(handleRef, () => ({
    toPng: () => {
      const chart = chartRef.current;
      if (!chart) return undefined;
      const width = 1200;
      const height = 520 + chartHeading(result, width).height + exportLegendHeight(result, width);
      const exported = echarts.init(document.createElement("div"), undefined, { width, height });
      try {
        exported.setOption({ ...chart.getOption(), animation: false });
        exported.setOption(chartLayout(result, width, height, true));
        applyPalette(exported, lightPalette);
        return exported.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#ffffff" });
      } finally {
        exported.dispose();
      }
    }
  }), [result]);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    chartRef.current = chart;
    const categories = result.chartCategories ?? [...new Set(result.chartSeries.map((item) => item.label))];
    const seriesNames = [...new Set(result.chartSeries.map((item) => item.series ?? result.chartLabel))];
    chart.setOption({
      ...chartLayout(result, chart.getWidth(), chart.getHeight()),
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
      dataZoom: categories.length > 12 ? [{ type: "slider", bottom: 0, start: 0, end: Math.min(100, 12 / categories.length * 100) }] : [],
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
    const resize = () => {
      chart.resize();
      chart.setOption(chartLayout(result, chart.getWidth(), chart.getHeight()));
    };
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

  const heading = chartHeading(result, 1200).title;
  const label = `${heading.text} · ${heading.subtext}`.replace(/\n/g, " ");
  return <div className={`chart-panel${result.chartType === "line" ? " chart-panel-tendency" : ""}`} ref={ref} role="img" aria-label={label} />;
});
