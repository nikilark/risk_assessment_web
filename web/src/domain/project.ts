import { normalizeLocale } from "./risk";
import defaultAgents from "../data/default-agents.json";
import expandedAgents from "../data/expanded-agents.json";
import { currentYear, projectYears } from "./years";
import type { AgentRecord, ExposureRecord, ProjectFile, ReportSection, ResearchType } from "./types";

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
      locale: "en",
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
      years: [currentYear()],
      points: [],
      exposures: []
    },
    report: {
      sections: defaultReportSections(),
      assetIds: []
    }
  };
}

function validateExposures(exposures: unknown[]): ExposureRecord[] {
  const seen = new Set<string>();
  return exposures.map((value, index) => {
    const exposure = value as Partial<ExposureRecord> | null;
    if (!exposure || typeof exposure.objectId !== "string" || !exposure.objectId.trim() ||
        typeof exposure.agentId !== "string" || !exposure.agentId.trim() ||
        typeof exposure.concentration !== "number" || !Number.isFinite(exposure.concentration) || exposure.concentration < 0 ||
        (exposure.year !== undefined && (!Number.isInteger(exposure.year) || exposure.year < 1 || exposure.year > 9999))) {
      throw new Error(`Некоректний запис концентрації №${index + 1}: потрібні ідентифікатори об'єкта й речовини та скінченна невід'ємна концентрація.`);
    }
    const year = exposure.year ?? currentYear();
    const key = JSON.stringify([exposure.objectId, exposure.agentId, year]);
    if (seen.has(key)) {
      throw new Error(`Повторний запис концентрації №${index + 1}: для кожної комбінації об'єкт/речовина/рік дозволено лише один запис.`);
    }
    seen.add(key);
    return { objectId: exposure.objectId, agentId: exposure.agentId, year, concentration: exposure.concentration };
  });
}

export function normalizeProject(input: unknown): ProjectFile {
  const value = input as Partial<ProjectFile>;
  if (!value || value.schema_version !== schemaVersion || !value.project || !value.research) {
    throw new Error("Підтримується лише JSON проєкту зі schema_version: 1.");
  }
  const defaults = createDefaultProject();
  if (value.research.years !== undefined && (!Array.isArray(value.research.years) ||
      value.research.years.some((year) => !Number.isInteger(year) || year < 1 || year > 9999))) {
    throw new Error("Роки мають бути цілими числами від 1 до 9999.");
  }
  const settings = {
    ...defaults.settings,
    ...value.settings,
    locale: normalizeLocale(value.settings?.locale),
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
      years: value.research.years ?? [],
      points: Array.isArray(value.research.points) ? value.research.points : [],
      exposures: Array.isArray(value.research.exposures) ? validateExposures(value.research.exposures) : []
    },
    report: {
      sections: Array.isArray(value.report?.sections) ? value.report.sections : defaultReportSections(),
      assetIds: Array.isArray(value.report?.assetIds) ? value.report.assetIds : []
    }
  };
  project.research.years = projectYears(project);
  return applyCatalogMode(project, Boolean(settings.expandedCatalog));
}
