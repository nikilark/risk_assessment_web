import {
  calculateAdditionalMortality,
  calculateCancer,
  calculateHazardQuotient,
  cancerRiskLevel,
  formatNumber,
  hazardRiskLevel,
  riskLabels
} from "./risk";
import type { AgentRecord, ChartSeries, ExposureRecord, ProjectFile, ResearchObject, ResultItem, RiskLevel } from "./types";

function selectedAgents(project: ProjectFile): AgentRecord[] {
  return project.project.agents.filter((agent) => agent.selected);
}

export function isCancerAgent(agent: AgentRecord): boolean {
  return agent.sfi > 0;
}

export function isNonCancerAgent(agent: AgentRecord): boolean {
  return agent.rfcLifelong > 0 || agent.rfcAcute > 0;
}

export function isParticleAgent(agent: AgentRecord): boolean {
  const name = agent.name.toLocaleLowerCase("uk-UA");
  return name.includes("(tsp)") || name.includes("pm10") || name.includes("pm2.5") || name.includes("рм10") || name.includes("рм2.5") || name.includes("частинки");
}

function positiveExposures(project: ProjectFile): Array<ExposureRecord & { object: ResearchObject; agent: AgentRecord }> {
  const objects = new Map(project.research.points.map((point) => [point.id, point]));
  const agents = new Map(selectedAgents(project).map((agent) => [agent.id, agent]));
  return project.research.exposures
    .filter((exposure) => exposure.concentration > 0)
    .map((exposure) => ({ ...exposure, object: objects.get(exposure.objectId), agent: agents.get(exposure.agentId) }))
    .filter((record): record is ExposureRecord & { object: ResearchObject; agent: AgentRecord } => Boolean(record.object && record.agent));
}

function marker(object: ResearchObject, level: RiskLevel, value: number) {
  if (!object.coordinate) return undefined;
  return {
    id: object.id,
    label: object.title,
    latitude: object.coordinate.latitude,
    longitude: object.coordinate.longitude,
    scale: object.coordinate.scale,
    riskLevel: level,
    value
  };
}

function methodNote(extra = "") {
  return extra;
}

function makeCancerResults(project: ProjectFile, flavor: "lifelong" | "acute"): ResultItem[] {
  const results: ResultItem[] = [];
  const flavorLabel = flavor === "lifelong" ? "Хронічний" : "Гострий";
  const exposures = positiveExposures(project).filter(({ agent }) => isCancerAgent(agent) && !isParticleAgent(agent));
  for (const agent of selectedAgents(project).filter((item) => isCancerAgent(item) && !isParticleAgent(item))) {
    const agentRecords = exposures.filter((record) => record.agent.id === agent.id);
    if (!agentRecords.length) continue;
    const rows: string[][] = [];
    const chartSeries: ChartSeries[] = [];
    const mapMarkers = [];
    for (const record of agentRecords) {
      const risk = calculateCancer(record.concentration, agent.sfi, record.object.population, flavor);
      rows.push([
        record.object.title,
        formatNumber(record.concentration),
        formatNumber(risk.ladd),
        formatNumber(risk.icr),
        formatNumber(risk.pcr),
        formatNumber(risk.pcrPer10000),
        riskLabels[risk.level]
      ]);
      chartSeries.push({ label: record.object.title, value: risk.icr });
      const mapPoint = marker(record.object, risk.level, risk.icr);
      if (mapPoint) mapMarkers.push(mapPoint);
    }
    const title = `${agent.name}: ${flavorLabel.toLocaleLowerCase("uk-UA")} канцерогенний ризик`;
    results.push({
      id: `cancer-${flavor}-${agent.id}`,
      title,
      category: "Канцерогенний ризик",
      methodNote: methodNote("ICR = LADD × SF"),
      headers: ["Об'єкт", "Концентрація", "LADD", "ICR", "PCR", "PCR на 10000", "Рівень ризику"],
      rows,
      chartLabel: "ICR",
      chartSeries,
      mapLegend: "Рівень ризику за ICR",
      mapMarkers
    });
  }
  const summed = new Map<string, { object: ResearchObject; icr: number }>();
  for (const record of exposures) {
    const risk = calculateCancer(record.concentration, record.agent.sfi, record.object.population, flavor);
    const current = summed.get(record.object.id) ?? { object: record.object, icr: 0 };
    current.icr += risk.icr;
    summed.set(record.object.id, current);
  }
  if (summed.size > 0) {
    const rows: string[][] = [];
    const chartSeries: ChartSeries[] = [];
    const mapMarkers = [];
    for (const { object, icr } of summed.values()) {
      const level = cancerRiskLevel(icr);
      rows.push([object.title, formatNumber(icr), riskLabels[level]]);
      chartSeries.push({ label: object.title, value: icr });
      const mapPoint = marker(object, level, icr);
      if (mapPoint) mapMarkers.push(mapPoint);
    }
    results.push({
      id: `cancer-sum-${flavor}`,
      title: `${flavorLabel} сумарний канцерогенний ризик`,
      category: "Канцерогенний ризик",
      methodNote: methodNote("Сума ICR за канцерогенними речовинами"),
      headers: ["Об'єкт", "ICR сум.", "Рівень ризику"],
      rows,
      chartLabel: "ICR сум.",
      chartSeries,
      mapLegend: "Рівень ризику за сумарним ICR",
      mapMarkers
    });
  }
  return results;
}

function makeNonCancerResults(project: ProjectFile, flavor: "lifelong" | "acute"): ResultItem[] {
  const flavorLabel = flavor === "lifelong" ? "Хронічний" : "Гострий";
  const outputs: ResultItem[] = [];
  const exposures = positiveExposures(project).filter(({ agent }) => isNonCancerAgent(agent) && !isParticleAgent(agent));
  const records = exposures
    .map((record) => {
      const rfc = flavor === "lifelong" ? record.agent.rfcLifelong : record.agent.rfcAcute;
      if (rfc <= 0) return undefined;
      const organs = flavor === "lifelong" ? record.agent.affectedOrgansLifelong : record.agent.affectedOrgansAcute;
      const hq = calculateHazardQuotient(record.concentration, rfc);
      const level = hazardRiskLevel(hq);
      return { ...record, rfc, organs, hq, level };
    })
    .filter((record): record is NonNullable<typeof record> => Boolean(record));

  for (const agent of selectedAgents(project).filter((item) => isNonCancerAgent(item) && !isParticleAgent(item))) {
    const agentRecords = records.filter((record) => record.agent.id === agent.id);
    if (!agentRecords.length) continue;
    const rows: string[][] = [];
    const chartSeries: ChartSeries[] = [];
    const mapMarkers = [];
    for (const record of agentRecords) {
      const organs = record.organs.length ? record.organs : ["—"];
      for (const organ of organs) {
        rows.push([
          record.object.title,
          organ,
          formatNumber(record.concentration),
          formatNumber(record.rfc),
          formatNumber(record.hq),
          riskLabels[record.level]
        ]);
      }
      chartSeries.push({ label: record.object.title, value: record.hq });
      const mapPoint = marker(record.object, record.level, record.hq);
      if (mapPoint) mapMarkers.push(mapPoint);
    }

    outputs.push({
      id: `non-cancer-${flavor}-agent-${agent.id}`,
      title: `${agent.name}: ${flavorLabel.toLocaleLowerCase("uk-UA")} неканцерогенний ризик`,
      category: "Неканцерогенний ризик",
      methodNote: methodNote("HQ = C / RfC"),
      headers: ["Об'єкт", "Орган", "Концентрація", "RfC", "HQ", "Рівень ризику"],
      rows,
      chartLabel: "HQ",
      chartSeries,
      mapLegend: "Рівень ризику за HQ",
      mapMarkers
    });
  }

  const summaryByObject = new Map<string, { object: ResearchObject; totalHi: number; organTotals: Map<string, number> }>();
  for (const record of records) {
    const current = summaryByObject.get(record.object.id) ?? { object: record.object, totalHi: 0, organTotals: new Map<string, number>() };
    current.totalHi += record.hq;
    for (const organ of record.organs) current.organTotals.set(organ, (current.organTotals.get(organ) ?? 0) + record.hq);
    summaryByObject.set(record.object.id, current);
  }

  if (summaryByObject.size > 0) {
    const rows: string[][] = [];
    const chartSeries: ChartSeries[] = [];
    const mapMarkers = [];
    const organColumns = [...summaryByObject.values()]
      .flatMap(({ organTotals }) => [...organTotals.entries()])
      .reduce((totals, [organ, hi]) => totals.set(organ, (totals.get(organ) ?? 0) + hi), new Map<string, number>());
    const sortedOrgans = [...organColumns.entries()].sort((a, b) => b[1] - a[1]).map(([organ]) => organ);

    for (const { object, totalHi, organTotals } of summaryByObject.values()) {
      const organEntries = [...organTotals.entries()].sort((a, b) => b[1] - a[1]);
      const level = hazardRiskLevel(totalHi);
      rows.push([
        object.title,
        formatNumber(totalHi),
        ...sortedOrgans.map((organ) => formatNumber(organTotals.get(organ) ?? 0)),
        riskLabels[level]
      ]);
      chartSeries.push({ label: `${object.title} · HI загальний`, value: totalHi, group: object.title });
      for (const [organ, hi] of organEntries) chartSeries.push({ label: `${object.title} · ${organ}`, value: hi, group: object.title });
      const mapPoint = marker(object, level, totalHi);
      if (mapPoint) mapMarkers.push(mapPoint);
    }

    outputs.push({
      id: `non-cancer-${flavor}-summary`,
      title: `${flavorLabel} сумарний неканцерогенний ризик`,
      category: "Неканцерогенний ризик",
      methodNote: methodNote("HI = ΣHQ; HI органів = ΣHQ за критичними органами"),
      headers: ["Об'єкт", "HI", ...sortedOrgans.map((organ) => `HI: ${organ}`), "Рівень ризику"],
      rows,
      chartLabel: "HI",
      chartSeries,
      mapLegend: "Рівень ризику за HI",
      mapMarkers
    });
  }
  return outputs;
}

function makeParticleResult(project: ProjectFile): ResultItem[] {
  const rows: string[][] = [];
  const chartSeries: ChartSeries[] = [];
  const mapMarkers = [];
  for (const record of positiveExposures(project).filter((item) => isParticleAgent(item.agent))) {
    const risk = calculateAdditionalMortality(record.concentration, record.object.deaths, record.object.population);
    rows.push([
      record.object.title,
      record.agent.name,
      formatNumber(record.concentration),
      formatNumber(risk.irm),
      formatNumber(risk.sf),
      formatNumber(risk.am),
      formatNumber(risk.amPer10000),
      riskLabels[risk.level]
    ]);
    chartSeries.push({ label: `${record.object.title} · ${record.agent.name}`, value: risk.amPer10000 });
    const mapPoint = marker(record.object, risk.level, risk.amPer10000);
    if (mapPoint) mapMarkers.push(mapPoint);
  }
  if (!rows.length) return [];
  return [
    {
      id: "particles-mortality",
      title: "Зважені частинки: додаткова смертність",
      category: "Зважені частинки",
      methodNote: methodNote("AM/IRM/SF calculation; перевірити застосовність для PM10/PM2.5"),
      headers: ["Об'єкт", "Речовина", "Концентрація", "IRM", "SF", "AM", "AM на 10000", "Рівень ризику"],
      rows,
      chartLabel: "AM на 10000",
      chartSeries,
      mapLegend: "Рівень ризику за AM на 10000",
      mapMarkers
    }
  ];
}

export function generateResults(project: ProjectFile): ResultItem[] {
  const results: ResultItem[] = [];
  if (project.project.research_type.cancer_lifelong) results.push(...makeCancerResults(project, "lifelong"));
  if (project.project.research_type.cancer_acute) results.push(...makeCancerResults(project, "acute"));
  if (project.project.research_type.non_cancer_lifelong) results.push(...makeNonCancerResults(project, "lifelong"));
  if (project.project.research_type.non_cancer_acute) results.push(...makeNonCancerResults(project, "acute"));
  if (project.project.research_type.suspended_particles) results.push(...makeParticleResult(project));
  return results;
}

export function resultToTsv(result: ResultItem): string {
  return [result.headers.join("\t"), ...result.rows.map((row) => row.join("\t"))].join("\n");
}

export function allResultsToTsv(results: ResultItem[]): string {
  return results.map((result) => [`# ${result.title}`, resultToTsv(result)].join("\n")).join("\n\n");
}
