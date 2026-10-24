import { calculateAdditionalMortality, calculateCancer, calculateHazardQuotient, cancerRiskLevel, formatNumber, hazardRiskLevel, riskLabels } from "./risk";
import { isParticleAgent } from "./results";
import { exposureYear, projectYears } from "./years";
import type { AgentRecord, ProjectFile, ResearchObject, ResearchType, ResultItem } from "./types";

export interface ComparisonSpec {
  metric: keyof ResearchType;
  aggregation: "agents" | "total" | "organs";
  objectIds: string[];
  agentIds: string[];
  years: number[];
  mapYear: number;
  mapAgentId: string;
  mapOrgan: string;
  tableMode: "comparison" | "rows" | "details";
  chartAxis: "items" | "years";
}

export const metricLabels: Record<keyof ResearchType, string> = {
  cancer_lifelong: "Хронічний канцерогенний ризик",
  cancer_acute: "Гострий канцерогенний ризик",
  non_cancer_lifelong: "Хронічний неканцерогенний ризик",
  non_cancer_acute: "Гострий неканцерогенний ризик",
  suspended_particles: "Зважені частинки: додаткова смертність"
};

export function eligibleAgents(project: ProjectFile, metric: keyof ResearchType): AgentRecord[] {
  return project.project.agents.filter((agent) => agent.selected && (
    metric === "suspended_particles" ? isParticleAgent(agent) :
    metric.startsWith("non_cancer") ? (metric.endsWith("lifelong") ? agent.rfcLifelong : agent.rfcAcute) > 0 :
    agent.sfi > 0 && !isParticleAgent(agent)
  ));
}

export function defaultComparison(project: ProjectFile): ComparisonSpec {
  const metric = (Object.keys(metricLabels) as Array<keyof ResearchType>).find((key) => project.project.research_type[key]) ?? "non_cancer_lifelong";
  const years = projectYears(project);
  const agentIds = eligibleAgents(project, metric).map((agent) => agent.id);
  return { metric, aggregation: "agents", objectIds: project.research.points.map((point) => point.id), agentIds,
    years, mapYear: years[years.length - 1], mapAgentId: agentIds[0] ?? "", mapOrgan: "", tableMode: "comparison", chartAxis: "items" };
}

interface Observation {
  object: ResearchObject;
  agentId: string;
  label: string;
  year: number;
  value: number;
  concentration?: number;
  details: Record<string, number>;
  organs: string[];
  complete?: boolean;
}

export function buildComparison(project: ProjectFile, spec: ComparisonSpec): ResultItem {
  const cancer = spec.metric.startsWith("cancer");
  const particles = spec.metric === "suspended_particles";
  const flavor = spec.metric.endsWith("lifelong") ? "lifelong" : "acute";
  const aggregation = particles ? "agents" : spec.aggregation;
  const agents = new Map(eligibleAgents(project, spec.metric).filter((agent) => spec.agentIds.includes(agent.id)).map((agent) => [agent.id, agent]));
  const objects = new Map(project.research.points.filter((point) => spec.objectIds.includes(point.id)).map((point) => [point.id, point]));
  const years = [...new Set(spec.years)].sort((a, b) => a - b);
  const level = cancer ? cancerRiskLevel : hazardRiskLevel;
  const measure = cancer ? "ICR" : particles ? "AM на 10000" : aggregation === "agents" ? "HQ" : "HI";
  const observations: Observation[] = [];
  for (const exposure of project.research.exposures) {
    const object = objects.get(exposure.objectId);
    const agent = agents.get(exposure.agentId);
    const year = exposureYear(exposure);
    if (!object || !agent || !years.includes(year) || !Number.isFinite(exposure.concentration) || exposure.concentration < 0) continue;
    const concentration = exposure.concentration;
    let value: number;
    let details: Record<string, number>;
    if (cancer) {
      const risk = calculateCancer(concentration, agent.sfi, object.population, flavor);
      value = risk.icr;
      details = { LADD: risk.ladd, SFi: agent.sfi, PCR: risk.pcr, "PCR на 10000": risk.pcrPer10000 };
    } else if (particles) {
      const risk = calculateAdditionalMortality(concentration, object.deaths, object.population);
      value = risk.amPer10000;
      details = { IRM: risk.irm, SF: risk.sf, AM: risk.am };
    } else {
      const rfc = flavor === "lifelong" ? agent.rfcLifelong : agent.rfcAcute;
      value = calculateHazardQuotient(concentration, rfc);
      details = { RfC: rfc };
    }
    observations.push({ object, agentId: agent.id, label: agent.name, year, value, concentration, details,
      organs: flavor === "lifelong" ? agent.affectedOrgansLifelong : agent.affectedOrgansAcute });
  }
  let records = observations;
  if (aggregation !== "agents") {
    const totals = new Map<string, Observation>();
    for (const observation of observations) {
      const labels = aggregation === "organs" ? observation.organs : ["Усі обрані речовини"];
      for (const label of labels) {
        const key = JSON.stringify([observation.object.id, observation.year, label]);
        const existing = totals.get(key);
        if (existing) existing.value += observation.value;
        else totals.set(key, { ...observation, agentId: "", label, concentration: undefined, details: {}, value: observation.value });
      }
    }
    records = [...totals.values()];
    for (const record of records) {
      const expected = [...agents.values()].filter((agent) => aggregation === "total" ||
        (flavor === "lifelong" ? agent.affectedOrgansLifelong : agent.affectedOrgansAcute).includes(record.label));
      record.complete = expected.every((agent) => observations.some((observation) =>
        observation.object.id === record.object.id && observation.year === record.year && observation.agentId === agent.id));
    }
  }
  const labelHeader = aggregation === "organs" ? "Орган" : "Речовина";
  const rowGroups = new Map<string, Observation[]>();
  for (const record of records) {
    const key = JSON.stringify([record.object.id, aggregation === "agents" ? record.agentId : record.label]);
    rowGroups.set(key, [...(rowGroups.get(key) ?? []), record]);
  }
  const detailed = spec.tableMode !== "comparison" || years.length === 1;
  const showYear = years.length > 1 || spec.tableMode !== "comparison";
  const detailHeaders = spec.tableMode === "details" ? [...new Set(records.flatMap((record) => Object.keys(record.details)))] : [];
  const headers = detailed
    ? ["Об'єкт", labelHeader, ...(showYear ? ["Рік"] : []), ...(aggregation === "agents" ? ["Концентрація"] : []), ...detailHeaders, measure, "Рівень ризику"]
    : ["Об'єкт", labelHeader, ...years.flatMap((year) => [`${measure}: ${year}`, `Рівень: ${year}`])];
  const rows = detailed
    ? records.map((record) => [record.object.title, record.label, ...(showYear ? [String(record.year)] : []),
      ...(aggregation === "agents" ? [formatNumber(record.concentration!)] : []),
      ...detailHeaders.map((header) => record.details[header] === undefined ? "—" : formatNumber(record.details[header])),
      record.complete === false ? "—" : formatNumber(record.value), record.complete === false ? "—" : riskLabels[level(record.value)]])
    : [...rowGroups.values()].map((group) => [group[0].object.title, group[0].label, ...years.flatMap((year) => {
      const record = group.find((item) => item.year === year);
      return record && record.complete !== false ? [formatNumber(record.value), riskLabels[level(record.value)]] : ["—", "—"];
    })]);
  const itemLabel = (record: Observation) => `${record.object.title} · ${record.label}`;
  const mapLabel = aggregation === "agents" ? agents.get(spec.mapAgentId)?.name : aggregation === "total" ? "Усі обрані речовини" : spec.mapOrgan;
  const mapRecords = records.filter((record) => record.complete !== false && record.year === spec.mapYear && (aggregation === "agents" ? record.agentId === spec.mapAgentId : record.label === mapLabel));
  const title = `${metricLabels[spec.metric]} · ${aggregation === "total" ? "сумарно" : aggregation === "organs" ? "за органами" : "за речовинами"} · ${years.length ? years.join(", ") : "роки не обрано"}`;
  const context = `Об'єкти: ${[...objects.values()].map((object) => object.title).join(", ") || "не обрано"}. Речовини: ${[...agents.values()].map((agent) => agent.name).join(", ") || "не обрано"}.`;
  return {
    id: comparisonId(spec), title,
    category: cancer ? "Канцерогенний ризик" : particles ? "Зважені частинки" : "Неканцерогенний ризик",
    methodNote: `${cancer ? "ICR = LADD × SF" : particles ? "AM/IRM/SF; застосовність формули потребує перевірки" : "HQ = C / RfC; HI = ΣHQ"}. ${context} Роки — окремі сценарії; значення між роками не підсумовуються. Порожні дані позначено «—».${aggregation !== "agents" ? " Суми показано лише за повних даних для обраних речовин (для HI органа — речовин, що впливають на цей орган)." : ""}`,
    headers, rows, chartLabel: measure,
    chartCategories: spec.chartAxis === "years" ? years.map(String) : undefined,
    chartType: spec.chartAxis === "years" ? "line" : "bar",
    chartSeries: records.filter((record) => record.complete !== false).map((record) => ({ label: spec.chartAxis === "years" ? String(record.year) : itemLabel(record), value: record.value,
      series: spec.chartAxis === "years" ? itemLabel(record) : years.length > 1 ? String(record.year) : undefined })),
    mapLegend: `Рівень ризику · ${measure} · ${mapLabel || "не обрано"} · ${spec.mapYear}`,
    mapYear: spec.mapYear,
    mapMarkers: mapRecords.flatMap((record) => record.object.coordinate ? [{
      id: record.object.id, label: record.object.title, ...record.object.coordinate, value: record.value, riskLevel: level(record.value)
    }] : [])
  };
}

export function comparisonId(spec: ComparisonSpec): string {
  return `comparison-${encodeURIComponent(JSON.stringify(spec))}`;
}

export function resolveComparison(project: ProjectFile, id: string): ResultItem | undefined {
  if (!id.startsWith("comparison-")) return undefined;
  try {
    const spec = JSON.parse(decodeURIComponent(id.slice("comparison-".length))) as ComparisonSpec;
    return buildComparison(project, spec);
  } catch {
    return undefined;
  }
}
