import type { ExposureRecord, ProjectFile } from "./types";

export function currentYear(): number {
  return new Date().getFullYear();
}

export function exposureYear(exposure: ExposureRecord): number {
  return exposure.year ?? currentYear();
}

export function projectYears(project: ProjectFile): number[] {
  const years = [...(project.research.years ?? []), ...project.research.exposures.map(exposureYear)];
  return [...new Set(years.length ? years : [currentYear()])].sort((a, b) => a - b);
}
