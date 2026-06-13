import defaultAgents from "../data/default-agents.json";
import expandedAgents from "../data/expanded-agents.json";
import type { AgentRecord, ProjectFile, ReportSection, ResearchType } from "./types";

export const schemaVersion = 1;

export function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultResearchType(): ResearchType {
  return {
    cancer_lifelong: false,
    cancer_acute: false,
    non_cancer_lifelong: true,
    non_cancer_acute: false,
    suspended_particles: false
  };
}

export function defaultReportSections(): ReportSection[] {
  return [
    {
      id: createId("section"),
      title: "Короткий виклад",
      body: "Стисло опишіть територію, джерела даних, ключові речовини та основні висновки оцінки ризику."
    },
    {
      id: createId("section"),
      title: "Методика",
      body: "Оцінка виконана за структурою методичних рекомендацій МОЗ України з перехресною перевіркою формул за EPA/ATSDR. Усі припущення і версія методики наведені у звіті."
    },
    {
      id: createId("section"),
      title: "Інтерпретація",
      body: "Порівнюйте канцерогенний ризик за ICR/CR, неканцерогенний ризик за HQ/HI, а результати для зважених частинок використовуйте з урахуванням зазначених обмежень."
    },
    {
      id: createId("section"),
      title: "Обмеження",
      body: "Результати залежать від якості концентрацій, чисельності населення, координат об'єктів та перевіреності токсикологічних значень каталогу."
    }
  ];
}

function agentKey(agent: Pick<AgentRecord, "name" | "cas">): string {
  return `${agent.name.trim().toLocaleLowerCase("uk-UA")}|${agent.cas.trim()}`;
}

function catalogAgents(expanded: boolean): AgentRecord[] {
  const source = expanded ? expandedAgents : defaultAgents;
  return (source as AgentRecord[]).map((agent) => ({ ...agent, selected: false }));
}

function isManualAgent(agent: AgentRecord): boolean {
  return agent.source === "manual" || agent.id.startsWith("agent-");
}

export function applyCatalogMode(project: ProjectFile, expanded: boolean): ProjectFile {
  const selected = new Map(project.project.agents.map((agent) => [agentKey(agent), Boolean(agent.selected)]));
  const selectedOutsideCatalog = project.project.agents.filter((agent) => agent.selected && !isManualAgent(agent));
  const catalog = catalogAgents(expanded).map((agent) => ({
    ...agent,
    selected: selected.get(agentKey(agent)) ?? false
  }));
  const catalogKeys = new Set(catalog.map(agentKey));
  const projectSpecific = [...project.project.agents.filter(isManualAgent), ...selectedOutsideCatalog]
    .filter((agent, index, agents) => {
      const key = agentKey(agent);
      return !catalogKeys.has(key) && agents.findIndex((item) => agentKey(item) === key) === index;
    })
    .map((agent) => ({ ...agent, selected: selected.get(agentKey(agent)) ?? Boolean(agent.selected) }));

  return {
    ...project,
    settings: { ...project.settings, expandedCatalog: expanded },
    project: { ...project.project, agents: [...catalog, ...projectSpecific] }
  };
}

export function createDefaultProject(): ProjectFile {
  return {
    schema_version: schemaVersion,
    settings: {
      locale: "uk-UA",
      theme: "system",
      primaryColor: "#17324d",
      accentColor: "#b68b3f",
      projectsBasePath: "researches",
      expandedCatalog: false
    },
    project: {
      title: "Нове дослідження",
      research_type: defaultResearchType(),
      agents: catalogAgents(false)
    },
    research: {
      points: [],
      exposures: []
    },
    report: {
      sections: defaultReportSections(),
      assetIds: []
    }
  };
}

export function normalizeProject(input: unknown): ProjectFile {
  const value = input as Partial<ProjectFile>;
  if (!value || value.schema_version !== schemaVersion || !value.project || !value.research) {
    throw new Error("Підтримується лише JSON проєкту зі schema_version: 1.");
  }
  const defaults = createDefaultProject();
  const settings = {
    ...defaults.settings,
    ...value.settings,
    theme: value.settings?.theme === "light" || value.settings?.theme === "dark" || value.settings?.theme === "system"
      ? value.settings.theme
      : "system"
  };
  const project: ProjectFile = {
    ...createDefaultProject(),
    ...value,
    settings,
    project: {
      title: value.project.title || "Нове дослідження",
      research_type: { ...defaultResearchType(), ...value.project.research_type },
      agents: Array.isArray(value.project.agents) ? value.project.agents : []
    },
    research: {
      points: Array.isArray(value.research.points) ? value.research.points : [],
      exposures: Array.isArray(value.research.exposures) ? value.research.exposures : []
    },
    report: {
      sections: Array.isArray(value.report?.sections) ? value.report.sections : defaultReportSections(),
      assetIds: Array.isArray(value.report?.assetIds) ? value.report.assetIds : []
    }
  };
  return applyCatalogMode(project, Boolean(settings.expandedCatalog));
}
