import type { ResultItem, ResultView } from "./types";

export type ReportAssetKind = ResultView;

export interface ReportAsset {
  key: string;
  resultId: string;
  kind: ReportAssetKind;
}

const labels: Record<ReportAssetKind, string> = {
  table: "Таблиця",
  chart: "Графік",
  map: "Мапа"
};

export function makeReportAssetKey(resultId: string, kind: ReportAssetKind): string {
  return `${resultId}::${kind}`;
}

export function parseReportAssetKey(key: string): ReportAsset {
  const [resultId, kind] = key.split("::") as [string, ReportAssetKind | undefined];
  return {
    key,
    resultId,
    kind: kind === "chart" || kind === "map" || kind === "table" ? kind : "table"
  };
}

export function reportAssetLabel(result: ResultItem, kind: ReportAssetKind): string {
  return `${labels[kind]}: ${result.title}`;
}

