import { Clipboard, Download, FilePlus, MapPinned } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { buildComparison, defaultComparison, eligibleAgents, metricLabels, type ComparisonSpec } from "../domain/comparison";
import { ComparisonControls } from "./ComparisonControls";
import { copyText, downloadDataUrl, downloadText, exportResult, safeFileName } from "../domain/files";
import { mapMarkersToPng } from "../domain/mapExport";
import { makeReportAssetKey, reportAssetLabel } from "../domain/reportAssets";
import { resultToTsv } from "../domain/results";
import type { ProjectFile, ResearchType, ResultItem, ResultView } from "../domain/types";
import { ChartPanel, type ChartPanelHandle } from "./ChartPanel";
import { ResultMap } from "./MapPanel";
import { TableView } from "./TableView";
import { ToggleGroup } from "./ToggleGroup";
import { projectYears } from "../domain/years";

function mapMarkersToTsv(result: ResultItem): string {
  return [
    ["Об'єкт", "Рік", "Широта", "Довгота", "Масштаб", result.mapLegend, "Рівень"].join("\t"),
    ...result.mapMarkers.map((marker) => [marker.label, result.mapYear ?? "", marker.latitude, marker.longitude, marker.scale ?? "city", marker.value, marker.riskLevel].join("\t"))
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
        year: result.mapYear,
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
  const [spec, setSpec] = useState(() => defaultComparison(project));
  const [actionNote, setActionNote] = useState("");
  const chartRef = useRef<ChartPanelHandle | null>(null);
  const selected = useMemo(() => buildComparison(project, spec), [project, spec]);
  const mapAgents = eligibleAgents(project, spec.metric).filter((agent) => spec.agentIds.includes(agent.id));
  const organs = [...new Set(mapAgents.flatMap((agent) => spec.metric.endsWith("lifelong") ? agent.affectedOrgansLifelong : agent.affectedOrgansAcute))];
  const effectiveSpec = {
    ...spec,
    mapYear: spec.years.includes(spec.mapYear) ? spec.mapYear : spec.years[0] ?? spec.mapYear,
    mapAgentId: mapAgents.some((agent) => agent.id === spec.mapAgentId) ? spec.mapAgentId : mapAgents[0]?.id ?? "",
    mapOrgan: organs.includes(spec.mapOrgan) ? spec.mapOrgan : organs[0] ?? ""
  };
  const mapResult = useMemo(() => {
    const result = buildComparison(project, effectiveSpec);
    return { ...result, title: `${result.title} · Мапа: ${result.mapLegend}` };
  }, [project, JSON.stringify(effectiveSpec)]);

  const flash = (message: string) => {
    setActionNote(message);
    window.setTimeout(() => setActionNote(""), 1600);
  };

  const addToReport = (view: ResultView) => {
    if (!selected) return;
    const item = view === "map" ? mapResult : selected;
    const key = makeReportAssetKey(item.id, view);
    const alreadyAdded = project.report.assetIds.includes(key) || (view === "table" && project.report.assetIds.includes(selected.id));
    if (!alreadyAdded) {
      updateProject({ ...project, report: { ...project.report, assetIds: [...project.report.assetIds, key] } });
    }
    flash(`Додано: ${reportAssetLabel(item, view)}`);
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
    const dataUrl = mapMarkersToPng(mapResult);
    const copied = dataUrl ? await copyPng(dataUrl) : false;
    if (!copied) await copyText(mapMarkersToTsv(mapResult));
    flash(copied ? "Мапу скопійовано як PNG" : "Браузер не дозволив PNG, скопійовано дані мапи");
  };

  const downloadCurrent = (view: ResultView) => {
    if (!selected) return;
    const exportTitle = `${selected.title} · ${spec.years.join(", ")}`;
    if (view === "table") {
      exportResult({ ...selected, title: exportTitle });
      flash("TSV збережено");
      return;
    }
    if (view === "chart") {
      const dataUrl = chartRef.current?.toPng();
      if (dataUrl) downloadDataUrl(`${safeFileName(exportTitle)}_chart.png`, dataUrl);
      flash(dataUrl ? "PNG збережено" : "Графік ще не готовий");
      return;
    }
    downloadText(`${safeFileName(mapResult.title)}_map.geojson`, mapMarkersToGeoJson(mapResult), "application/geo+json;charset=utf-8");
    flash("GeoJSON збережено");
  };

  const downloadMapPng = () => {
    if (!selected) return;
    const dataUrl = mapMarkersToPng(mapResult);
    if (dataUrl) downloadDataUrl(`${safeFileName(mapResult.title)}_map.png`, dataUrl);
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
        <div className="empty-state">Введіть концентрації для обраного типу ризику, щоб сформувати результати.</div>
      ) : (
        <div className="results-layout">
          <ComparisonControls project={project} spec={spec} onChange={setSpec} />

          {selected && (
            <div className="result-detail">
              <div className="result-header">
                <div className="result-config-row">
                  <select aria-label="Показник" value={spec.metric} onChange={(event) => {
                    const metric = event.target.value as keyof ResearchType;
                    const agentIds = eligibleAgents(project, metric).map((agent) => agent.id);
                    setSpec({ ...spec, metric, agentIds, mapAgentId: agentIds[0] ?? "", aggregation: "agents", mapOrgan: "" });
                  }}>
                    {(Object.keys(metricLabels) as Array<keyof ResearchType>).filter((key) => project.project.research_type[key])
                      .map((key) => <option key={key} value={key}>{metricLabels[key]}</option>)}
                  </select>
                  {spec.metric !== "suspended_particles" && <ToggleGroup<ComparisonSpec["aggregation"]>
                    label="Розрахунок" value={spec.aggregation} onChange={(aggregation) => setSpec({ ...spec, aggregation })}
                    options={[{ value: "agents", label: "Окремо" }, { value: "total", label: "Сумарно" },
                      ...(spec.metric.startsWith("non_cancer") ? [{ value: "organs" as const, label: "За органами" }] : [])]} />}
                </div>
                <div className="result-year-selection" role="group" aria-label="Роки порівняння">
                  <span>Роки</span>
                  {projectYears(project).map((year) => <label key={year}>
                    <input type="checkbox" checked={spec.years.includes(year)} onChange={() => setSpec({ ...spec,
                      years: spec.years.includes(year) ? spec.years.filter((item) => item !== year) : [...spec.years, year].sort((a, b) => a - b)
                    })} />{year}
                  </label>)}
                  {projectYears(project).length > 1 && <button className="ghost" onClick={() => setSpec({ ...spec, years: projectYears(project) })}>Усі роки</button>}
                </div>
              </div>

              <div className="result-sections">
                <details className="result-section" open>
                  <summary>Таблиця</summary>
                  <div className="view-actions">
                    <div className="button-row">
                      <button className="secondary" disabled={!selected.rows.length} onClick={() => addToReport("table")}><FilePlus size={16} /> До звіту</button>
                      <button className="secondary" disabled={!selected.rows.length} onClick={() => copyCurrent("table")}><Clipboard size={16} /> Копіювати</button>
                      <button className="secondary" disabled={!selected.rows.length} onClick={() => downloadCurrent("table")}><Download size={16} /> TSV</button>
                    </div>
                    <ToggleGroup label="Вигляд таблиці" value={spec.tableMode === "details" ? "details" : "rows"}
                      options={[{ value: "rows", label: "Коротка" }, { value: "details", label: "Повна" }]}
                      onChange={(tableMode) => setSpec({ ...spec, tableMode })} />
                  </div>
                  {selected.rows.length ? <TableView headers={selected.headers} rows={selected.rows} /> : <p className="empty-state">Немає даних для обраних об’єктів, речовин і років. Змініть вибір або введіть концентрації.</p>}
                </details>

                <details className="result-section" open>
                  <summary>Графік</summary>
                  <div className="view-actions">
                    <div className="button-row">
                      <button className="secondary" disabled={!selected.rows.length} onClick={() => addToReport("chart")}><FilePlus size={16} /> До звіту</button>
                      <button className="secondary" disabled={!selected.rows.length} onClick={() => copyCurrent("chart")}><Clipboard size={16} /> Копіювати</button>
                      <button className="secondary" disabled={!selected.rows.length} onClick={() => downloadCurrent("chart")}><Download size={16} /> PNG</button>
                    </div>
                    <ToggleGroup label="Вигляд графіка" value={spec.chartAxis}
                      options={[{ value: "items", label: "Стовпчики" }, { value: "years", label: "Тенденція" }]}
                      onChange={(chartAxis) => setSpec({ ...spec, chartAxis })} />
                  </div>
                  <ChartPanel ref={chartRef} result={selected} />
                </details>

                {project.research.points.some((point) => point.coordinate) && (
                  <details className="result-section" open>
                    <summary><MapPinned size={16} /> Мапа</summary>
                    <div className="view-actions">
                      <div className="button-row">
                        <button className="secondary" disabled={!mapResult.mapMarkers.length} onClick={() => addToReport("map")}><FilePlus size={16} /> До звіту</button>
                        <button className="secondary" disabled={!mapResult.mapMarkers.length} onClick={() => copyCurrent("map")}><Clipboard size={16} /> Копіювати</button>
                        <button className="secondary" disabled={!mapResult.mapMarkers.length} onClick={downloadMapPng}><Download size={16} /> PNG</button>
                        <button className="secondary" disabled={!mapResult.mapMarkers.length} onClick={() => downloadCurrent("map")}><Download size={16} /> GeoJSON</button>
                      </div>
                      <div className="map-filters">
                        {spec.years.length > 1 && <label><select aria-label="Рік мапи" value={effectiveSpec.mapYear} onChange={(event) => setSpec({ ...spec, mapYear: Number(event.target.value) })}>
                          {spec.years.map((year) => <option key={year} value={year}>{year}</option>)}
                        </select></label>}
                        {spec.aggregation === "agents" && <label><select aria-label="Речовина на мапі" value={effectiveSpec.mapAgentId} onChange={(event) => setSpec({ ...spec, mapAgentId: event.target.value })}>
                          {mapAgents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
                        </select></label>}
                        {spec.aggregation === "organs" && <label><select aria-label="Орган на мапі" value={effectiveSpec.mapOrgan} onChange={(event) => setSpec({ ...spec, mapOrgan: event.target.value })}>
                          {organs.map((organ) => <option key={organ} value={organ}>{organ}</option>)}
                        </select></label>}
                      </div>
                    </div>
                    {mapResult.mapMarkers.length ? <ResultMap result={mapResult} /> : <p className="empty-state">Немає даних з координатами для цього вибору.</p>}
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
