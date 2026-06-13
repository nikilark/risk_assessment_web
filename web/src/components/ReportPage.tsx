import { Printer, Trash2 } from "lucide-react";
import { methodology } from "../domain/methodology";
import { parseReportAssetKey, reportAssetLabel } from "../domain/reportAssets";
import type { ProjectFile, ResultItem } from "../domain/types";
import { ChartPanel } from "./ChartPanel";
import { ResultMap } from "./MapPanel";
import { TableView } from "./TableView";

export function ReportPage({
  project,
  updateProject,
  results
}: {
  project: ProjectFile;
  updateProject: (project: ProjectFile) => void;
  results: ResultItem[];
}) {
  const assets = project.report.assetIds
    .map(parseReportAssetKey)
    .map((asset) => ({ ...asset, result: results.find((result) => result.id === asset.resultId) }))
    .filter((asset): asset is ReturnType<typeof parseReportAssetKey> & { result: ResultItem } => Boolean(asset.result));
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
        <button className="primary" onClick={() => window.print()}><Printer size={16} /> Роздрукувати</button>
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
          <TableView
            headers={["Об'єкт", "Населення", "Випадки смерті", "Координати"]}
            rows={project.research.points.map((object) => [
              object.title,
              object.population.toLocaleString("uk-UA"),
              object.deaths.toLocaleString("uk-UA"),
              object.coordinate ? `${object.coordinate.latitude.toFixed(5)}, ${object.coordinate.longitude.toFixed(5)}` : "—"
            ])}
          />
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
              <p className="muted">{asset.result.methodNote}</p>
              {asset.kind === "table" && <TableView headers={asset.result.headers} rows={asset.result.rows} />}
              {asset.kind === "chart" && asset.result.chartSeries.length > 0 && <ChartPanel result={asset.result} />}
              {asset.kind === "map" && asset.result.mapMarkers.length > 0 && <ResultMap result={asset.result} />}
            </div>
          ))}
        </section>
      </article>
    </section>
  );
}
