import { describe, expect, it } from "vitest";
import { buildComparison, defaultComparison, eligibleAgents, resolveComparison } from "./comparison";
import { createDefaultProject, normalizeProject } from "./project";
import { generateResults } from "./results";
import { currentYear } from "./years";

function fixture() {
  const project = createDefaultProject();
  project.research.years = [2020, 2021];
  const agents = project.project.agents.filter((agent) => ["Аміак", "Завислі частинки (РМ10)"].includes(agent.name));
  project.project.agents = agents.map((agent) => ({ ...agent, selected: true }));
  project.research.points = ["A", "B"].map((id, index) => ({ id, title: id, population: 10000, deaths: 100,
    coordinate: { latitude: 50 + index, longitude: 30 + index } }));
  project.research.exposures = [2020, 2021].flatMap((year) => project.research.points.flatMap((point) => agents.map((agent) => ({
    objectId: point.id, agentId: agent.id, year,
    concentration: agent.rfcLifelong * (year === 2020 ? 2 : 4)
  }))));
  return project;
}

describe("year comparisons", () => {
  it("applies the PM10/TSP correction in both result paths while retaining PM2.5 for HQ only", () => {
    const project = createDefaultProject();
    project.project.research_type.suspended_particles = true;
    project.project.agents = project.project.agents.filter((agent) => /частинки/.test(agent.name)).map((agent) => ({ ...agent, selected: true }));
    project.research.points = [{ id: "A", title: "A", population: 50000, deaths: 100 }];
    project.research.exposures = project.project.agents.map((agent) => ({ objectId: "A", agentId: agent.id, concentration: 0.1 }));
    const spec = { ...defaultComparison(project), metric: "suspended_particles" as const, tableMode: "details" as const };
    const result = buildComparison(project, spec);
    expect(result.rows).toHaveLength(2);
    for (const row of result.rows) {
      expect(row[result.headers.indexOf("AM")]).toBe(row[1].includes("TSP") ? "2.1" : "3.5");
    }
    const legacy = generateResults(project).find((item) => item.id === "particles-mortality")!;
    expect(legacy.rows).toHaveLength(2);
    for (const row of legacy.rows) expect(row[legacy.headers.indexOf("AM")]).toBe(row[1].includes("TSP") ? "2.1" : "3.5");
    expect(eligibleAgents(project, "suspended_particles").some((agent) => agent.name.includes("РМ2.5"))).toBe(false);
    expect(eligibleAgents(project, "non_cancer_lifelong").some((agent) => agent.name.includes("РМ2.5"))).toBe(true);
  });
  it("keeps all object/agent/year combinations independent and pivots years into columns", () => {
    const project = fixture();
    const result = buildComparison(project, { ...defaultComparison(project), tableMode: "comparison" });
    expect(result.rows).toHaveLength(4);
    expect(result.headers).toEqual(["Об'єкт", "Речовина", "HQ: 2020", "Рівень: 2020", "HQ: 2021", "Рівень: 2021"]);
    expect(result.rows.every((row) => row[2] === "2" && row[4] === "4")).toBe(true);
    expect(result.chartSeries).toHaveLength(8);
    expect(new Set(result.chartSeries.map((item) => item.series))).toEqual(new Set(["2020", "2021"]));
    const printable = buildComparison(project, { ...defaultComparison(project), tableMode: "rows" });
    expect(printable.rows).toHaveLength(8);
    expect(printable.headers).toEqual(["Об'єкт", "Речовина", "Рік", "Концентрація", "HQ", "Рівень ризику"]);
  });

  it("supports all agents at one place and one agent at all places across years", () => {
    const project = fixture();
    const spec = defaultComparison(project);
    expect(buildComparison(project, { ...spec, objectIds: ["A"] }).rows).toHaveLength(4);
    expect(buildComparison(project, { ...spec, agentIds: [spec.agentIds[0]] }).rows).toHaveLength(4);
    expect(buildComparison(project, { ...spec, objectIds: ["A"], agentIds: [spec.agentIds[0]], years: [2020] }).chartSeries.map((item) => item.value)).toEqual([2]);
  });

  it("sums agents and organ HI within each year without summing across years", () => {
    const project = fixture();
    const spec = defaultComparison(project);
    for (const aggregation of ["total", "organs"] as const) {
      const result = buildComparison(project, { ...spec, aggregation, tableMode: "comparison" });
      expect(result.rows).toHaveLength(2);
      expect(result.rows.every((row) => row[2] === "4" && row[4] === "8")).toBe(true);
    }
    const legacy = generateResults(project).find((result) => result.id === "non-cancer-lifelong-summary")!;
    expect(legacy.rows.map((row) => row[1])).toEqual(["4", "4", "8", "8"]);
  });

  it("distinguishes a measured zero from missing data and keeps empty years on a trend axis", () => {
    const project = fixture();
    const spec = { ...defaultComparison(project), tableMode: "comparison" as const, agentIds: [project.project.agents[0].id], objectIds: ["A"] };
    project.research.exposures = [{ objectId: "A", agentId: spec.agentIds[0], year: 2020, concentration: 0 }];
    const result = buildComparison(project, spec);
    expect(result.rows[0][2]).toBe("0");
    expect(result.rows[0][4]).toBe("—");
    expect(result.chartSeries.map((item) => item.value)).toEqual([0]);
    expect(buildComparison(project, { ...spec, chartAxis: "years" }).chartCategories).toEqual(["2020", "2021"]);
    expect(buildComparison(project, { ...spec, mapYear: 2021 }).mapMarkers).toEqual([]);
  });

  it("does not present partial agent totals as complete risks when a year has missing concentrations", () => {
    const project = fixture();
    const spec = { ...defaultComparison(project), tableMode: "comparison" as const, objectIds: ["A"], aggregation: "total" as const };
    project.research.exposures = project.research.exposures.filter((exposure) => !(exposure.year === 2021 && exposure.agentId === spec.agentIds[1]));
    const result = buildComparison(project, spec);
    expect(result.rows[0][2]).toBe("4");
    expect(result.rows[0][4]).toBe("—");
    expect(result.chartSeries.map((item) => item.value)).toEqual([4]);
    expect(result.mapMarkers).toEqual([]);
  });

  it("selects one agent and one year per map and restores exact report selections", () => {
    const project = fixture();
    const spec = defaultComparison(project);
    const oldMap = buildComparison(project, { ...spec, mapYear: 2020 });
    const newMap = buildComparison(project, { ...spec, mapYear: 2021 });
    expect(oldMap.mapMarkers.map((marker) => marker.value)).toEqual([2, 2]);
    expect(newMap.mapMarkers.map((marker) => marker.value)).toEqual([4, 4]);
    expect(oldMap.mapLegend).toContain("2020");
    const saved = JSON.parse(JSON.stringify(project));
    expect(resolveComparison(saved, oldMap.id)).toEqual(oldMap);
    expect(resolveComparison(saved, newMap.id)).toEqual(newMap);
    const filtered = buildComparison(project, { ...spec, objectIds: ["B"], agentIds: [spec.agentIds[1]], tableMode: "details" });
    expect(resolveComparison(saved, filtered.id)).toEqual(filtered);
    expect(filtered.headers).toContain("RfC");
  });

  it("loads old projects into the current year and allows the same pair in different years", () => {
    const project = fixture();
    delete project.research.years;
    project.research.exposures = [{ objectId: "A", agentId: project.project.agents[0].id, concentration: 1 }];
    const migrated = normalizeProject(project);
    expect(migrated.research.years).toEqual([currentYear()]);
    expect(migrated.research.exposures[0].year).toBe(currentYear());
    migrated.research.exposures.push({ ...migrated.research.exposures[0], year: currentYear() - 1 });
    expect(normalizeProject(migrated).research.exposures).toHaveLength(2);
    migrated.research.exposures.push({ ...migrated.research.exposures[0], year: undefined });
    expect(() => normalizeProject(migrated)).toThrow("Повторний запис");
  });

  it.each([0, 10000, 2020.5, NaN, "2020"])("rejects invalid years %s", (year) => {
    const project = fixture();
    expect(() => normalizeProject({ ...project, research: { ...project.research, years: [year] } })).toThrow("Роки");
    expect(() => normalizeProject({ ...project, research: { ...project.research, exposures: [{ ...project.research.exposures[0], year }] } })).toThrow("Некоректний запис");
  });
});


it("formats current and saved result paths without changing numeric risk values", () => {
  const project = fixture();
  project.research.exposures[0].concentration = 0.012345;
  const spec = { ...defaultComparison(project), tableMode: "details" as const };
  const en = buildComparison(project, spec);
  const enLegacy = generateResults(project);
  project.settings.locale = "ua";
  const ua = buildComparison(project, spec);
  expect(ua.locale).toBe("ua");
  expect(ua.rows).toEqual(en.rows.map(row => row.map(value => /^-?\d+(\.\d+)?(e-?\d+)?$/.test(value) ? value.replace(".", ",") : value)));
  expect(ua.chartSeries).toEqual(en.chartSeries);
  expect(ua.mapMarkers).toEqual(en.mapMarkers);
  const uaLegacy = generateResults(project);
  uaLegacy.forEach((result, index) => {
    expect(result.locale).toBe("ua");
    expect(result.chartSeries).toEqual(enLegacy[index].chartSeries);
    expect(result.rows).toEqual(enLegacy[index].rows.map(row => row.map(value => /^-?\d+(\.\d+)?(e-?\d+)?$/.test(value) ? value.replace(".", ",") : value)));
  });
});
