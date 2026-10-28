import { describe, expect, it } from "vitest";
import basic from "../data/default-agents.json";
import expanded from "../data/expanded-agents.json";
import { buildComparison, defaultComparison } from "./comparison";
import { createDefaultProject, normalizeProject } from "./project";
import { calculateHazardQuotient } from "./risk";
import type { AgentRecord } from "./types";

for (const [name, catalog] of [["basic", basic], ["expanded", expanded]] as const) {
  describe(`${name} source-backed reference values`, () => {
    const agents = catalog as AgentRecord[];
    it.each([
      ["Сірки діоксид", 0.08, 0.66, 0], ["Вуглецю оксид", 3, 23, 0],
      ["Водень сульфід", 0.001, 0.042, 0], ["Фенол", 0.006, 5.8, 0],
      ["Формальдегід", 0.003, 0.055, 0.046], ["Азоту діоксид", 0.04, 0.47, 0]
    ])("uses documented project benchmarks for %s", (chemical, chronic, acute, sf) => {
      const agent = agents.find(a => a.name === chemical)!;
      expect([agent.rfcLifelong, agent.rfcAcute, agent.sfi]).toEqual([chronic, acute, sf]);
      expect(agent.parameterSources?.rfcAcute?.unit).toBe("mg/m3");
      expect(agent.parameterSources?.rfcAcute?.url).toContain("oehha.ca.gov");
    });
    it("keeps the chronic CO surrogate distinguishable from an EPA RfC", () => {
      const co = agents.find(a => a.cas === "630-08-0")!;
      expect(co.referenceNotes).toContain("еквівалент ГДК");
      expect(co.parameterSources?.rfcLifelong?.basis).toContain("not an EPA RfC");
    });
    it("prevents thousand-fold reference-value errors from returning", () => {
      expect(agents.find(a => a.name === "Бензол")!.sfi).toBe(0.027);
      expect(agents.find(a => a.name === "Акрилонітрил")!.rfcLifelong).toBe(0.002);
      const solvent = agents.find(a => a.name === "Тетрахлоретилен")!;
      expect([solvent.rfcLifelong, solvent.sfi]).toEqual([0.035, 0.002]);
      const chloroform = agents.find(a => a.name === "Хлороформ")!;
      expect([chloroform.rfcLifelong, chloroform.sfi]).toEqual([0.098, 0.081]);
    });
  });
}

it("imports old catalog records with verified CO and TSP parameters and keeps their exposures", () => {
  const project = createDefaultProject();
  project.project.agents = project.project.agents.map(a => ({ ...a, selected: ["Вуглецю оксид", "Зважені частинки (TSP)"].includes(a.name),
    ...(a.name === "Вуглецю оксид" ? { rfcLifelong: 0 } : {}) }));
  project.research.years = [2025];
  project.research.points = [{ id: "point", title: "Point", population: 50000, deaths: 100 }];
  project.research.exposures = project.project.agents.filter(a => a.selected).map(a => ({ objectId: "point", agentId: a.id, year: 2025, concentration: a.name === "Вуглецю оксид" ? 3 : 0.1 }));
  const imported = normalizeProject(JSON.parse(JSON.stringify(project)));
  expect(imported.research.exposures).toEqual(project.research.exposures);
  const spec = defaultComparison(imported);
  const hq = buildComparison(imported, spec);
  expect(hq.rows).toHaveLength(2);
  expect(hq.rows.map(row => row[hq.headers.indexOf("HQ")])).toEqual(["1", "1"]);
  expect(hq.methodNote).toContain("еквівалент ГДК");
  const mortality = buildComparison(imported, { ...spec, metric: "suspended_particles", tableMode: "details" });
  expect(mortality.rows[0][mortality.headers.indexOf("C(PM10)")]).toBe("0.06");
  expect(mortality.rows[0][mortality.headers.indexOf("AM")]).toBe("2.1");
});

it("calculates the MOH NO2 example arithmetically, without copying its printed typo", () => {
  expect(calculateHazardQuotient(0.099, 0.04)).toBeCloseTo(2.475);
});
