import { describe, expect, it } from "vitest";
import { createDefaultProject } from "./project";
import { generateResults } from "./results";

describe("particulate non-cancer results", () => {
  it.each(["lifelong", "acute"] as const)("includes particle HQs in %s results and organ totals", (flavor) => {
    const project = createDefaultProject();
    project.project.research_type = {
      cancer_lifelong: false, cancer_acute: false,
      non_cancer_lifelong: flavor === "lifelong", non_cancer_acute: flavor === "acute",
      suspended_particles: false
    };
    const names = ["Завислі частинки (РМ10)", "Завислі частинки (РМ2.5)", "Зважені частинки (TSP)", "Аміак"];
    const agents = project.project.agents.filter((agent) => names.includes(agent.name));
    expect(agents).toHaveLength(4);
    project.project.agents = agents.map((agent) => ({ ...agent, selected: true }));
    project.research.points = [{ id: "object", title: "Test", population: 10000, deaths: 100 }];
    project.research.exposures = agents.map((agent) => ({
      objectId: "object", agentId: agent.id,
      concentration: (flavor === "lifelong" ? agent.rfcLifelong : agent.rfcAcute) * 2
    }));
    const results = generateResults(project);
    for (const agent of agents) {
      const individual = results.find((result) => result.id === `non-cancer-${flavor}-agent-${agent.id}`);
      expect(individual?.chartSeries[0].value).toBeCloseTo(2);
    }
    const summary = results.find((result) => result.id === `non-cancer-${flavor}-summary`)!;
    expect(summary.chartSeries[0].value).toBeCloseTo(8);
    expect(summary.rows[0][summary.headers.indexOf("HI: органи дихання")]).toBe("8");
    expect(results.some((result) => result.id === "particles-mortality")).toBe(false);
    project.project.research_type.suspended_particles = true;
    expect(generateResults(project).find((result) => result.id === "particles-mortality")?.rows).toHaveLength(3);
  });

  it("skips agents without a reference concentration for the selected duration", () => {
    const project = createDefaultProject();
    const particle = project.project.agents.find((agent) => agent.name.includes("РМ10"))!;
    project.project.agents = [{ ...particle, selected: true, rfcLifelong: 0 }];
    project.research.points = [{ id: "object", title: "Test", population: 10000, deaths: 100 }];
    project.research.exposures = [{ objectId: "object", agentId: particle.id, concentration: 0.1 }];
    expect(generateResults(project)).toEqual([]);
  });
});
