import { eligibleAgents, metricLabels, type ComparisonSpec } from "../domain/comparison";
import { projectYears } from "../domain/years";
import type { ProjectFile, ResearchType } from "../domain/types";

export function ComparisonControls({ project, spec, onChange }: {
  project: ProjectFile; spec: ComparisonSpec; onChange: (spec: ComparisonSpec) => void;
}) {
  const agents = eligibleAgents(project, spec.metric);
  const years = projectYears(project);
  const change = (patch: Partial<ComparisonSpec>) => onChange({ ...spec, ...patch });
  const toggle = <T extends string | number,>(values: T[], value: T) => values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
  const filters = [
    { label: "Об'єкти", items: project.research.points.map((point) => ({ id: point.id, label: point.title })), values: spec.objectIds, key: "objectIds" as const },
    { label: "Речовини", items: agents.map((agent) => ({ id: agent.id, label: agent.name })), values: spec.agentIds, key: "agentIds" as const }
  ];
  return <aside className="comparison-controls panel">
    <h2>Порівняння</h2>
    <label>Показник<select aria-label="Показник" value={spec.metric} onChange={(event) => {
      const metric = event.target.value as keyof ResearchType;
      const agentIds = eligibleAgents(project, metric).map((agent) => agent.id);
      change({ metric, agentIds, mapAgentId: agentIds[0] ?? "", aggregation: "agents", mapOrgan: "" });
    }}>
      {(Object.keys(metricLabels) as Array<keyof ResearchType>).filter((key) => project.project.research_type[key]).map((key) => <option key={key} value={key}>{metricLabels[key]}</option>)}
    </select></label>
    <label>Розрахунок<select aria-label="Розрахунок" value={spec.aggregation} onChange={(event) => change({ aggregation: event.target.value as ComparisonSpec["aggregation"] })}>
      <option value="agents">Кожна речовина окремо</option>
      {spec.metric !== "suspended_particles" && <option value="total">Сумарний ризик обраних речовин</option>}
      {spec.metric.startsWith("non_cancer") && <option value="organs">HI за органами</option>}
    </select></label>
    <div className="comparison-presets">
      <span className="muted">Швидкий вибір</span>
      <button className="secondary" onClick={() => change({ objectIds: [spec.objectIds[0] ?? project.research.points[0]?.id].filter(Boolean), agentIds: agents.map((agent) => agent.id), aggregation: "agents" })}>Речовини одного об'єкта</button>
      <button className="secondary" onClick={() => change({ objectIds: project.research.points.map((point) => point.id), agentIds: [spec.agentIds[0] ?? agents[0]?.id].filter(Boolean), aggregation: "agents" })}>Одна речовина на всіх об'єктах</button>
      <button className="secondary" onClick={() => change({ objectIds: project.research.points.map((point) => point.id), agentIds: agents.map((agent) => agent.id), aggregation: "agents" })}>Усі об'єкти й речовини</button>
    </div>
    {filters.map((filter) => <details key={filter.key} open>
      <summary>{filter.label} · {filter.values.length}/{filter.items.length}</summary>
      <div className="button-row"><button className="ghost" onClick={() => change({ [filter.key]: filter.items.map((item) => item.id) })}>Усі</button><button className="ghost" onClick={() => change({ [filter.key]: [] })}>Очистити</button></div>
      <div className="comparison-options">{filter.items.map((item) => <label key={item.id}><input type="checkbox" checked={filter.values.includes(item.id)} onChange={() => change({ [filter.key]: toggle(filter.values, item.id) })} />{item.label}</label>)}</div>
    </details>)}
    {years.length > 1 && <details open><summary>Роки · {spec.years.length}/{years.length}</summary>
      <div className="button-row"><button className="ghost" onClick={() => change({ years })}>Усі роки</button></div>
      <div className="comparison-options">{years.map((year) => <label key={year}><input type="checkbox" checked={spec.years.includes(year)} onChange={() => change({ years: toggle(spec.years, year) })} />{year}</label>)}</div>
    </details>}
    <label>Таблиця<select aria-label="Вигляд таблиці" value={spec.tableMode} onChange={(event) => change({ tableMode: event.target.value as ComparisonSpec["tableMode"] })}>
      <option value="comparison">Порівняння ризику</option><option value="rows">Роки рядками (для друку)</option><option value="details">Деталі розрахунку</option>
    </select></label>
    {years.length > 1 && <label>Групування графіка<select aria-label="Групування графіка" value={spec.chartAxis} onChange={(event) => change({ chartAxis: event.target.value as ComparisonSpec["chartAxis"] })}>
      <option value="items">Стовпчики за об'єктами й речовинами</option><option value="years">Динаміка за роками</option>
    </select></label>}
  </aside>;
}
