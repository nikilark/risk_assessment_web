import { describe, expect, it } from "vitest";
import { createDefaultProject, normalizeProject } from "./project";
import { generateResults } from "./results";
import { currentYear } from "./years";

function importFixture() {
  const project = createDefaultProject();
  const agent = project.project.agents.find((item) => item.name === "Бензол")!;
  agent.selected = true;
  project.research.points = [{ id: "object", title: "Test", population: 10000, deaths: 100 }];
  project.research.exposures = [{ objectId: "object", agentId: agent.id, year: currentYear(), concentration: agent.rfcLifelong * 2 }];
  return project;
}

describe("imported exposures", () => {
  it("preserves valid concentrations and calculated totals across a JSON round trip", () => {
    const project = importFixture();
    const imported = normalizeProject(JSON.parse(JSON.stringify(project)));
    expect(imported.research.exposures).toEqual(project.research.exposures);
    expect(generateResults(imported)).toEqual(generateResults(project));
  });

  it.each([1, 2, 0])("rejects a duplicate pair even when its concentration is multiplied by %s", (multiplier) => {
    const project = importFixture();
    const exposure = project.research.exposures[0];
    project.research.exposures.push({ ...exposure, concentration: exposure.concentration * multiplier });
    expect(() => normalizeProject(project)).toThrow("Повторний запис концентрації №2");
  });

  it("allows the same agent at different objects, different agents at one object, and zero concentration", () => {
    const project = importFixture();
    project.research.points.push({ ...project.research.points[0], id: "other" });
    project.research.exposures.push({ ...project.research.exposures[0], objectId: "other" });
    const agent = project.project.agents.find((item) => item.name === "Аміак")!;
    project.research.exposures.push({ objectId: "object", agentId: agent.id, year: currentYear(), concentration: 0 });
    expect(normalizeProject(project).research.exposures).toEqual(project.research.exposures);
  });

  it.each([-1, NaN, Infinity, -Infinity, "0.1", null, undefined])("rejects invalid concentration %s", (concentration) => {
    const project = importFixture();
    const input = { ...project, research: { ...project.research, exposures: [{ ...project.research.exposures[0], concentration }] } };
    expect(() => normalizeProject(input)).toThrow("Некоректний запис концентрації №1");
  });

  it.each([null, {}, { objectId: "", agentId: "agent", concentration: 1 }])("rejects malformed exposure records", (exposure) => {
    const project = importFixture();
    expect(() => normalizeProject({ ...project, research: { ...project.research, exposures: [exposure] } })).toThrow("Некоректний запис концентрації №1");
  });
});
