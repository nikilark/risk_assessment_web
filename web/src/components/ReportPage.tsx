import { formatCoordinate, formatCount } from "../domain/risk";
import { Printer, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { mapMarkersToPng } from "../domain/mapExport";
import { methodology } from "../domain/methodology";
import { resolveComparison } from "../domain/comparison";
import { exposureYear, projectYears } from "../domain/years";
import { numberFormatter } from "../domain/risk";
import { parseReportAssetKey, reportAssetLabel } from "../domain/reportAssets";
import type { ProjectFile, ResultItem } from "../domain/types";
import { ChartPanel } from "./ChartPanel";
import { ResultMap } from "./MapPanel";
import { TableView } from "./TableView";

function mapImageKey(result: ResultItem) {
  return JSON.stringify([result.title, result.mapLegend, result.category, result.locale, result.mapMarkers]);
}

function ReportMap({ result, onReady }: { result: ResultItem; onReady: (key: string, ready: boolean) => void }) {
  const [png, setPng] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const key = mapImageKey(result);
    onReady(key, false);
    setPng(""); setError("");
    void mapMarkersToPng(result, controller.signal).then(async (image) => {
      const decoded = new Image(); decoded.src = image; await decoded.decode();
      if (controller.signal.aborted) return;
      setPng(image); onReady(key, true);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Не вдалося підготувати мапу до друку.");
    });
    return () => controller.abort();
  }, [result, onReady, attempt]);
  return <><ResultMap result={result} />
    {error ? <p role="alert" className="no-print">{error} <button className="secondary" onClick={() => setAttempt(attempt + 1)}>Повторити</button></p>
      : !png && <p role="status" className="no-print">Підготовка мапи до друку…</p>}
    {png && <img className="print-only report-map-image" src={png} alt={result.mapLegend} />}</>;
}

export function ReportPage({
  project,
  updateProject,
  results
}: {
  project: ProjectFile;
  updateProject: (project: ProjectFile) => void;
  results: ResultItem[];
}) {
  const formatNumber = numberFormatter(project.settings.locale);
  const [mapReady, setMapReady] = useState<Record<string, boolean>>({});
  const onMapReady = useCallback((key: string, ready: boolean) => setMapReady(previous => previous[key] === ready ? previous : { ...previous, [key]: ready }), []);
  const assets = useMemo(() => project.report.assetIds
    .map(parseReportAssetKey)
    .map((asset) => ({ ...asset, result: resolveComparison(project, asset.resultId) ?? results.find((result) => result.id === asset.resultId) }))
    .filter((asset): asset is ReturnType<typeof parseReportAssetKey> & { result: ResultItem } => Boolean(asset.result)), [project, results]);
  const mapsReady = assets.filter(asset => asset.kind === "map").every(asset => mapReady[mapImageKey(asset.result)]);
  const updateSection = (id: string, field: "title" | "body", value: string) =>
    updateProject({
      ...project,
      report: {
        ...project.report,
        sections: project.report.sections.map((section) => section.id === id ? { ...section, [field]: value } : section)
      }
    });
  const removeAsset = (id: string) =>
    updateProject({ ...project, report: { ...project.report, assetIds: project.report.assetIds.filter((item) => item !== id) } });

  return (
    <section className="page report-page">
      <div className="page-heading no-print">
        <div>
          <p className="eyebrow">крок 4</p>
          <h1>Звіт</h1>
        </div>
        <button className="primary" disabled={!mapsReady} title={mapsReady ? undefined : "Дочекайтеся підготовки мап до друку"} onClick={() => window.print()}><Printer size={16} /> Роздрукувати</button>
      </div>

      <article className="report-sheet">
        <header className="report-cover">
          <p>Оцінка ризику для здоров'я населення</p>
          <h1>{project.project.title}</h1>
          <span>{new Date().toLocaleDateString("uk-UA")}</span>
        </header>

        {project.report.sections.map((section) => (
          <section className="report-section" key={section.id}>
            <input className="report-title no-print-edit" value={section.title} onChange={(event) => updateSection(section.id, "title", event.target.value)} />
            <h2 className="print-only">{section.title}</h2>
            <textarea className="report-body no-print-edit" value={section.body} onChange={(event) => updateSection(section.id, "body", event.target.value)} />
            <p className="print-only">{section.body}</p>
          </section>
        ))}

        <section className="report-section">
          <h2>Методичні джерела</h2>
          <p>{methodology.caution}</p>
          <ul>
            {[...methodology.primary, ...methodology.crossChecks].map((source) => (
              <li key={source.url}>{source.label}: {source.url}</li>
            ))}
          </ul>
        </section>

        <section className="report-section">
          <h2>Вхідні дані</h2>
          <p>Роки дослідження: {projectYears(project).join(", ")}. Населення та випадки смерті об'єкта однакові для всіх років. Роки порівнюються як окремі сценарії експозиції.</p>
          <TableView
            headers={["Об'єкт", "Населення", "Випадки смерті", "Координати"]}
            rows={project.research.points.map((object) => [
              object.title,
              formatCount(object.population, project.settings.locale),
              formatCount(object.deaths, project.settings.locale),
              object.coordinate ? `${formatCoordinate(object.coordinate.latitude, project.settings.locale)}; ${formatCoordinate(object.coordinate.longitude, project.settings.locale)}` : "—"
            ])}
          />
          <h3>Концентрації за роками</h3>
          <TableView headers={["Об'єкт", "Речовина", "Рік", "Концентрація"]} rows={project.research.exposures.flatMap((exposure) => {
            const object = project.research.points.find((point) => point.id === exposure.objectId);
            const agent = project.project.agents.find((item) => item.id === exposure.agentId && item.selected);
            return object && agent ? [[object.title, agent.name, String(exposureYear(exposure)), formatNumber(exposure.concentration)]] : [];
          })} />
        </section>

        <section className="report-section">
          <h2>Матеріали результатів</h2>
          {!assets.length && <p>До звіту ще не додано таблиць, графіків або мап зі сторінки результатів.</p>}
          {assets.map((asset) => (
            <div className="report-asset" key={asset.key}>
              <div className="asset-actions no-print">
                <button className="ghost" onClick={() => removeAsset(asset.key)}><Trash2 size={16} /></button>
              </div>
              <h3>{reportAssetLabel(asset.result, asset.kind)}</h3>
              {asset.kind !== "map" && asset.result.years && <p className="report-asset-years">Роки: {asset.result.years.join(", ")}</p>}
              {asset.kind === "map" && <p>{asset.result.mapLegend}</p>}
              <p className="muted">{asset.result.methodNote}</p>
              {asset.kind === "table" && <TableView headers={asset.result.headers} rows={asset.result.rows} />}
              {asset.kind === "chart" && asset.result.chartSeries.length > 0 && <ChartPanel result={asset.result} />}
              {asset.kind === "map" && asset.result.mapMarkers.length > 0 && <ReportMap result={asset.result} onReady={onMapReady} />}
              {!asset.result.rows.length && <p>Немає даних для збереженого вибору. Перевірте об'єкти, речовини та роки.</p>}
            </div>
          ))}
        </section>
      </article>
    </section>
  );
}
