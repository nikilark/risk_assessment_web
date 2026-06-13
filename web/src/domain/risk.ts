import type { RiskLevel } from "./types";

export type CancerFlavor = "lifelong" | "acute";

export const populationMultiplier = 10000;

export const riskLabels: Record<RiskLevel, string> = {
  minimal: "Мінімальний",
  low: "Низький",
  medium: "Середній",
  high: "Високий",
  critical: "Критичний"
};

export const riskColors: Record<RiskLevel, string> = {
  minimal: "#2f855a",
  low: "#76a043",
  medium: "#d69e2e",
  high: "#dd6b20",
  critical: "#c53030"
};

export function cancerRiskLevel(icr: number): RiskLevel {
  if (icr < 1e-6) return "minimal";
  if (icr < 1e-4) return "low";
  if (icr < 1e-3) return "medium";
  if (icr < 1) return "high";
  return "critical";
}

export function hazardRiskLevel(value: number): RiskLevel {
  if (value < 0.1) return "minimal";
  if (value < 1) return "low";
  if (value < 5) return "medium";
  if (value < 10) return "high";
  return "critical";
}

export function calculateLadd(concentration: number, flavor: CancerFlavor): number {
  const exposureFrequency = 350;
  const exposureDuration = 70;
  const averagingTime = 70;
  const add = (consumptionRate: number, bodyWeight: number) =>
    (concentration * consumptionRate * exposureDuration * exposureFrequency) / (bodyWeight * averagingTime * 365);

  if (flavor === "lifelong") {
    const ageDurations = [6, 12, 18];
    const rates = [4, 20, 22];
    const weights = [15, 42, 70];
    return ageDurations.reduce((sum, duration, index) => sum + duration * add(rates[index], weights[index]), 0) / averagingTime;
  }
  return add(20, 60);
}

export function calculateCancer(concentration: number, slopeFactor: number, population: number, flavor: CancerFlavor) {
  const ladd = calculateLadd(concentration, flavor);
  const icr = ladd * slopeFactor;
  const pcr = icr * population;
  return {
    ladd,
    icr,
    pcr,
    pcra: pcr / 70,
    pcrPer10000: icr * populationMultiplier,
    pcraPer10000: (icr / 70) * populationMultiplier,
    level: cancerRiskLevel(icr)
  };
}

export function calculateHazardQuotient(concentration: number, referenceConcentration: number): number {
  return referenceConcentration > 0 ? concentration / referenceConcentration : 0;
}

export function calculateAdditionalMortality(concentration: number, deaths: number, population: number) {
  const safePopulation = Math.max(1, population);
  const irm = (deaths * 0.005) / (365 * safePopulation);
  const sf = irm * 70 * 365;
  const am = concentration * 0.55 * sf * safePopulation;
  const amPer10000 = (am / safePopulation) * populationMultiplier;
  return {
    irm,
    sf,
    am,
    amPer10000,
    level: hazardRiskLevel(amPer10000)
  };
}

export function normalizeNumber(value: number, significantDigits = 8): number {
  if (!Number.isFinite(value) || value === 0) return value;
  return Number(value.toPrecision(significantDigits));
}

export function formatNumber(value: number, digits = 8): string {
  if (!Number.isFinite(value)) return "—";
  const rounded = normalizeNumber(value, digits);
  const absolute = Math.abs(rounded);
  if (absolute > 0 && (absolute < 0.01 || absolute >= 1_000_000)) {
    const [mantissa, exponent] = rounded.toExponential(Math.max(1, digits - 1)).split("e");
    return `${mantissa.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "")}e${Number(exponent)}`;
  }
  return new Intl.NumberFormat("uk-UA", {
    maximumFractionDigits: digits,
    maximumSignificantDigits: digits
  }).format(rounded);
}
