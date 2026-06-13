export type RiskLevel = "minimal" | "low" | "medium" | "high" | "critical";
export type ResultCategory = "Канцерогенний ризик" | "Неканцерогенний ризик" | "Зважені частинки";
export type ResultView = "table" | "chart" | "map";
export type ThemeMode = "system" | "light" | "dark";
export type PlaceScale = "street" | "district" | "city" | "region";

export interface ResearchType {
  cancer_lifelong: boolean;
  cancer_acute: boolean;
  non_cancer_lifelong: boolean;
  non_cancer_acute: boolean;
  suspended_particles: boolean;
}

export interface AgentRecord {
  id: string;
  sourceIds?: string[];
  name: string;
  cas: string;
  originalCas?: string;
  dangerClass: number;
  rfcLifelong: number;
  affectedOrgansLifelong: string[];
  rfcAcute: number;
  affectedOrgansAcute: string[];
  sfi: number;
  selected?: boolean;
  source?: string;
  reviewStatus?: string;
}

export interface ResearchObject {
  id: string;
  title: string;
  population: number;
  deaths: number;
  coordinate?: {
    latitude: number;
    longitude: number;
    scale?: PlaceScale;
  };
}

export interface ExposureRecord {
  objectId: string;
  agentId: string;
  concentration: number;
}

export interface ReportSection {
  id: string;
  title: string;
  body: string;
}

export interface ReportState {
  sections: ReportSection[];
  assetIds: string[];
}

export interface SettingsState {
  locale: string;
  theme: ThemeMode;
  primaryColor: string;
  accentColor: string;
  projectsBasePath: string;
  expandedCatalog: boolean;
}

export interface ProjectFile {
  schema_version: 1;
  settings: SettingsState;
  project: {
    title: string;
    research_type: ResearchType;
    agents: AgentRecord[];
  };
  research: {
    points: ResearchObject[];
    exposures: ExposureRecord[];
  };
  report: ReportState;
}

export interface ChartSeries {
  label: string;
  value: number;
  group?: string;
}

export interface MapMarker {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  scale?: PlaceScale;
  riskLevel: RiskLevel;
  value: number;
}

export interface ResultItem {
  id: string;
  title: string;
  category: ResultCategory;
  methodNote: string;
  headers: string[];
  rows: string[][];
  chartLabel: string;
  chartSeries: ChartSeries[];
  mapLegend: string;
  mapMarkers: MapMarker[];
}
