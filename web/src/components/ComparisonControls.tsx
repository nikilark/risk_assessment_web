import { eligibleAgents, type ComparisonSpec } from "../domain/comparison";
import type { ProjectFile } from "../domain/types";

export function ComparisonControls({ project, spec, onChange }: {
  project: ProjectFile; spec: ComparisonSpec; onChange: (spec: ComparisonSpec) => void;
}) {
  const agents = eligibleAgents(project, spec.metric);
  const change = (patch: Partial<ComparisonSpec>) => onChange({ ...spec, ...patch });
  const toggle = <T extends string | number,>(values: T[], value: T) => values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
  const filters = [
    { label: "Об'єкти", items: project.research.points.map((point) => ({ id: point.id, label: point.title })), values: spec.objectIds, key: "objectIds" as const },
    { label: "Речовини", items: agents.map((agent) => ({ id: agent.id, label: agent.name })), values: spec.agentIds, key: "agentIds" as const }
  ];
  return <aside className="comparison-controls panel">
    <h2>Порівняння</h2>
    {filters.map((filter) => <details key={filter.key} open>
      <summary>{filter.label} · {filter.values.length}/{filter.items.length}</summary>
      <div className="button-row"><button className="ghost" onClick={() => change({ [filter.key]: filter.items.map((item) => item.id) })}>Усі</button><button className="ghost" onClick={() => change({ [filter.key]: [] })}>Очистити</button></div>
      <div className={`comparison-options comparison-options-${filter.key}`}>{filter.items.map((item) => <label key={item.id}><input type="checkbox" checked={filter.values.includes(item.id)} onChange={() => change({ [filter.key]: toggle(filter.values, item.id) })} />{item.label}</label>)}</div>
    </details>)}
  </aside>;
}
