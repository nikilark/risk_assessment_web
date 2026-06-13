import { Clipboard, Download, FilePlus, MapPinned } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { copyText, downloadDataUrl, downloadText, exportResult, safeFileName } from "../domain/files";
import { mapExportMarkerRadii, placeScaleLabels, riskLevelOrder } from "../domain/mapLegend";
import { makeReportAssetKey, reportAssetLabel } from "../domain/reportAssets";
import { resultToTsv } from "../domain/results";
import { formatNumber, riskColors, riskLabels } from "../domain/risk";
import type { MapMarker, PlaceScale, ProjectFile, ResultItem, ResultView } from "../domain/types";
import { ChartPanel, type ChartPanelHandle } from "./ChartPanel";
import { ResultMap } from "./MapPanel";
import { TableView } from "./TableView";

function mapMarkersToTsv(result: ResultItem): string {
  return [
    ["Об'єкт", "Широта", "Довгота", "Масштаб", result.mapLegend, "Рівень"].join("\t"),
    ...result.mapMarkers.map((marker) => [marker.label, marker.latitude, marker.longitude, marker.scale ?? "city", marker.value, marker.riskLevel].join("\t"))
  ].join("\n");
}

function mapMarkersToGeoJson(result: ResultItem): string {
  return JSON.stringify({
    type: "FeatureCollection",
    name: result.title,
    features: result.mapMarkers.map((marker) => ({
      type: "Feature",
      properties: {
        label: marker.label,
        value: marker.value,
        riskLevel: marker.riskLevel,
        scale: marker.scale ?? "city",
        legend: result.mapLegend
      },
      geometry: {
        type: "Point",
        coordinates: [marker.longitude, marker.latitude]
      }
    }))
  }, null, 2);
}

function markerScale(marker: MapMarker): PlaceScale {
  return marker.scale ?? "city";
}

function fitText(context: CanvasRenderingContext2D, value: string, maxWidth: number): string {
  if (context.measureText(value).width <= maxWidth) return value;
  let trimmed = value;
  while (trimmed.length > 3 && context.measureText(`${trimmed}...`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}...`;
}

function mapMarkersToPng(result: ResultItem): string {
  const canvas = document.createElement("canvas");
  canvas.width = 1400;
  canvas.height = 900;
  const context = canvas.getContext("2d");
  if (!context) return "";

  context.fillStyle = "#fffdf8";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#1f2933";
  context.font = "700 34px Arial, sans-serif";
  context.fillText(fitText(context, result.title, 1220), 72, 56);
  context.font = "18px Arial, sans-serif";
  context.fillStyle = "#5f6b7a";
  context.fillText(result.mapLegend, 72, 88);

  const plot = { x: 72, y: 138, width: 1256, height: 610 };
  context.fillStyle = "#ffffff";
  context.fillRect(plot.x, plot.y, plot.width, plot.height);
  context.strokeStyle = "#cfd8dc";
  context.lineWidth = 2;
  context.strokeRect(plot.x, plot.y, plot.width, plot.height);

  context.strokeStyle = "#edf1f3";
  context.lineWidth = 1;
  for (let index = 1; index < 6; index += 1) {
    const x = plot.x + (plot.width / 6) * index;
    const y = plot.y + (plot.height / 6) * index;
    context.beginPath();
    context.moveTo(x, plot.y);
    context.lineTo(x, plot.y + plot.height);
    context.moveTo(plot.x, y);
    context.lineTo(plot.x + plot.width, y);
    context.stroke();
  }

  const latitudes = result.mapMarkers.map((marker) => marker.latitude);
  const longitudes = result.mapMarkers.map((marker) => marker.longitude);
  let minLatitude = Math.min(...latitudes);
  let maxLatitude = Math.max(...latitudes);
  let minLongitude = Math.min(...longitudes);
  let maxLongitude = Math.max(...longitudes);
  const latitudePadding = Math.max((maxLatitude - minLatitude) * 0.08, 0.005);
  const longitudePadding = Math.max((maxLongitude - minLongitude) * 0.08, 0.005);
  minLatitude -= latitudePadding;
  maxLatitude += latitudePadding;
  minLongitude -= longitudePadding;
  maxLongitude += longitudePadding;
  const latitudeRange = maxLatitude - minLatitude || 1;
  const longitudeRange = maxLongitude - minLongitude || 1;
  const pointPosition = (marker: MapMarker) => ({
    x: plot.x + ((marker.longitude - minLongitude) / longitudeRange) * plot.width,
    y: plot.y + ((maxLatitude - marker.latitude) / latitudeRange) * plot.height
  });

  for (const marker of [...result.mapMarkers].sort((a, b) => mapExportMarkerRadii[markerScale(b)] - mapExportMarkerRadii[markerScale(a)])) {
    const position = pointPosition(marker);
    const radius = mapExportMarkerRadii[markerScale(marker)];
    context.beginPath();
    context.arc(position.x, position.y, radius, 0, Math.PI * 2);
    context.fillStyle = riskColors[marker.riskLevel];
    context.fill();
    context.lineWidth = 4;
    context.strokeStyle = "#ffffff";
    context.stroke();
  }

  for (const marker of result.mapMarkers) {
    const position = pointPosition(marker);
    const radius = mapExportMarkerRadii[markerScale(marker)];
    const alignRight = position.x > plot.x + plot.width * 0.66;
    const labelX = position.x + (alignRight ? -radius - 12 : radius + 12);
    const maxLabelWidth = alignRight ? Math.max(140, labelX - plot.x - 18) : Math.max(140, plot.x + plot.width - labelX - 18);
    context.font = "700 17px Arial, sans-serif";
    const label = fitText(context, marker.label, Math.min(340, maxLabelWidth));
    context.font = "16px Arial, sans-serif";
    const detail = fitText(context, `${formatNumber(marker.value)} · ${riskLabels[marker.riskLevel]} · ${placeScaleLabels[markerScale(marker)]}`, Math.min(340, maxLabelWidth));
    const boxWidth = Math.max(context.measureText(label).width, context.measureText(detail).width) + 18;
    const boxX = alignRight ? labelX - boxWidth + 8 : labelX - 8;

    context.fillStyle = "rgba(255, 255, 255, 0.88)";
    context.fillRect(boxX, position.y - 26, boxWidth, 49);
    context.textAlign = alignRight ? "right" : "left";
    context.fillStyle = "#1f2933";
    context.font = "700 17px Arial, sans-serif";
    context.fillText(label, labelX, position.y - 7);
    context.fillStyle = "#5f6b7a";
    context.font = "16px Arial, sans-serif";
    context.fillText(detail, labelX, position.y + 15);
    context.textAlign = "left";
  }

  context.font = "16px Arial, sans-serif";
  context.fillStyle = "#334e68";
  context.fillText("Рівень ризику", 72, 795);
  let legendX = 72;
  for (const level of riskLevelOrder) {
    context.beginPath();
    context.arc(legendX + 8, 826, 8, 0, Math.PI * 2);
    context.fillStyle = riskColors[level];
    context.fill();
    context.fillStyle = "#334e68";
    context.fillText(riskLabels[level], legendX + 22, 831);
    legendX += 142;
  }

  context.font = "14px Arial, sans-serif";
  context.fillStyle = "#7b8794";
  context.fillText("PNG-схема мапи працює офлайн: координати збережені у проекті, кольори відповідають рівню ризику.", 72, 870);

  return canvas.toDataURL("image/png");
}

async function copyPng(dataUrl: string): Promise<boolean> {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  } catch {
    return false;
  }
}

export function ResultsPage({
  project,
  updateProject,
  results
}: {
  project: ProjectFile;
  updateProject: (project: ProjectFile) => void;
  results: ResultItem[];
}) {
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [actionNote, setActionNote] = useState("");
  const chartRef = useRef<ChartPanelHandle | null>(null);
  const grouped = useMemo(() => {
    const groups = new Map<string, ResultItem[]>();
    for (const result of results) groups.set(result.category, [...(groups.get(result.category) ?? []), result]);
    return [...groups.entries()];
  }, [results]);
  const selected = results.find((result) => result.id === selectedId) ?? results[0];

  const flash = (message: string) => {
    setActionNote(message);
    window.setTimeout(() => setActionNote(""), 1600);
  };

  const addToReport = (view: ResultView) => {
    if (!selected) return;
    const key = makeReportAssetKey(selected.id, view);
    const alreadyAdded = project.report.assetIds.includes(key) || (view === "table" && project.report.assetIds.includes(selected.id));
    if (!alreadyAdded) {
      updateProject({ ...project, report: { ...project.report, assetIds: [...project.report.assetIds, key] } });
    }
    flash(`Додано: ${reportAssetLabel(selected, view)}`);
  };

  const copyCurrent = async (view: ResultView) => {
    if (!selected) return;
    if (view === "table") {
      await copyText(resultToTsv(selected));
      flash("Таблицю скопійовано");
      return;
    }
    if (view === "chart") {
      const dataUrl = chartRef.current?.toPng();
      const copied = dataUrl ? await copyPng(dataUrl) : false;
      flash(copied ? "Графік скопійовано як PNG" : "Браузер не дозволив скопіювати PNG");
      return;
    }
    const dataUrl = mapMarkersToPng(selected);
    const copied = dataUrl ? await copyPng(dataUrl) : false;
    if (!copied) await copyText(mapMarkersToTsv(selected));
    flash(copied ? "Мапу скопійовано як PNG" : "Браузер не дозволив PNG, скопійовано дані мапи");
  };

  const downloadCurrent = (view: ResultView) => {
    if (!selected) return;
    if (view === "table") {
      exportResult(selected);
      flash("TSV збережено");
      return;
    }
    if (view === "chart") {
      const dataUrl = chartRef.current?.toPng();
      if (dataUrl) downloadDataUrl(`${safeFileName(selected.title)}_chart.png`, dataUrl);
      flash(dataUrl ? "PNG збережено" : "Графік ще не готовий");
      return;
    }
    downloadText(`${safeFileName(selected.title)}_map.geojson`, mapMarkersToGeoJson(selected), "application/geo+json;charset=utf-8");
    flash("GeoJSON збережено");
  };

  const downloadMapPng = () => {
    if (!selected) return;
    const dataUrl = mapMarkersToPng(selected);
    if (dataUrl) downloadDataUrl(`${safeFileName(selected.title)}_map.png`, dataUrl);
    flash(dataUrl ? "PNG мапи збережено" : "Мапа ще не готова");
  };

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">крок 3</p>
          <h1>Результати</h1>
        </div>
      </div>

      {!results.length ? (
        <div className="empty-state">Введіть хоча б одне значення експозиції більше нуля, щоб сформувати результати.</div>
      ) : (
        <div className="results-layout">
          <aside className="result-list">
            {grouped.map(([category, items]) => (
              <details key={category} open>
                <summary><span>{category}</span><small>{items.length}</small></summary>
                {items.map((result) => (
                  <button key={result.id} className={selected?.id === result.id ? "active" : ""} onClick={() => setSelectedId(result.id)}>
                    <span>{result.title}</span>
                  </button>
                ))}
              </details>
            ))}
          </aside>

          {selected && (
            <div className="result-detail">
              <div className="result-header">
                <div>
                  <h2>{selected.title}</h2>
                  <p>{selected.methodNote}</p>
                </div>
              </div>

              <div className="result-sections">
                <details className="result-section" open>
                  <summary>Таблиця</summary>
                  <div className="view-actions">
                    <div className="button-row">
                      <button className="secondary" onClick={() => addToReport("table")}><FilePlus size={16} /> До звіту</button>
                      <button className="secondary" onClick={() => copyCurrent("table")}><Clipboard size={16} /> Копіювати</button>
                      <button className="secondary" onClick={() => downloadCurrent("table")}><Download size={16} /> TSV</button>
                    </div>
                  </div>
                  <TableView headers={selected.headers} rows={selected.rows} />
                </details>

                <details className="result-section" open>
                  <summary>Графік</summary>
                  <div className="view-actions">
                    <div className="button-row">
                      <button className="secondary" onClick={() => addToReport("chart")}><FilePlus size={16} /> До звіту</button>
                      <button className="secondary" onClick={() => copyCurrent("chart")}><Clipboard size={16} /> Копіювати</button>
                      <button className="secondary" onClick={() => downloadCurrent("chart")}><Download size={16} /> PNG</button>
                    </div>
                  </div>
                  <ChartPanel ref={chartRef} result={selected} />
                </details>

                {selected.mapMarkers.length > 0 && (
                  <details className="result-section" open>
                    <summary><MapPinned size={16} /> Мапа</summary>
                    <div className="view-actions">
                      <div className="button-row">
                        <button className="secondary" onClick={() => addToReport("map")}><FilePlus size={16} /> До звіту</button>
                        <button className="secondary" onClick={() => copyCurrent("map")}><Clipboard size={16} /> Копіювати</button>
                        <button className="secondary" onClick={downloadMapPng}><Download size={16} /> PNG</button>
                        <button className="secondary" onClick={() => downloadCurrent("map")}><Download size={16} /> GeoJSON</button>
                      </div>
                    </div>
                    <ResultMap result={selected} />
                  </details>
                )}
              </div>
              {actionNote && <span className="action-note">{actionNote}</span>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
