import { describe, expect, it } from "vitest";
import { calculateAdditionalMortality, calculateCancer, calculateHazardQuotient, calculateLadd, cancerRiskLevel, formatNumber, hazardRiskLevel, normalizeNumber } from "./risk";
import { riskLevelsForCategory } from "./mapLegend";

describe("risk formulas", () => {
  it("calculates hazard quotient and levels", () => {
    expect(calculateHazardQuotient(0.12, 0.04)).toBeCloseTo(3);
    expect(hazardRiskLevel(0.05)).toBe("minimal");
    expect(hazardRiskLevel(3)).toBe("medium");
    expect(hazardRiskLevel(11)).toBe("critical");
  });

  it("calculates cancer risk with current app thresholds", () => {
    const risk = calculateCancer(0.1, 1.2, 100000, "lifelong");
    expect(risk.icr).toBeGreaterThan(0);
    expect(cancerRiskLevel(1e-7)).toBe("minimal");
    expect(cancerRiskLevel(1e-5)).toBe("low");
    expect(cancerRiskLevel(1e-2)).toBe("high");
  });

  it("weights all 70 years of lifetime exposure and propagates the dose into population risk", () => {
    const risk = calculateCancer(0.1, 1.2, 50000, "lifelong");
    expect(risk.ladd).toBeCloseTo(0.03240704500978474, 12);
    expect(risk.icr).toBeCloseTo(0.03888845401174169, 12);
    expect(risk.pcr).toBeCloseTo(1944.4227005870844, 9);
    expect(risk.pcra).toBeCloseTo(27.77746715124406, 10);
    expect(calculateLadd(0.1, "acute")).toBeCloseTo(0.0319634703196347, 12);
  });

  it("has four cancer categories while retaining the critical non-cancer category", () => {
    expect(cancerRiskLevel(0.001)).toBe("high");
    expect(cancerRiskLevel(1)).toBe("high");
    expect(cancerRiskLevel(10)).toBe("high");
    expect(riskLevelsForCategory("Канцерогенний ризик")).toEqual(["minimal", "low", "medium", "high"]);
    expect(riskLevelsForCategory("Неканцерогенний ризик")).toContain("critical");
    expect(hazardRiskLevel(10)).toBe("critical");
  });

  it("calculates particulate mortality values", () => {
    const risk = calculateAdditionalMortality(0.2, 100, 50000);
    expect(risk.irm).toBeGreaterThan(0);
    expect(risk.sf).toBeGreaterThan(0);
    expect(risk.amPer10000).toBeCloseTo(risk.am / 50000 * 10000);
  });

  it("uses PM10 directly and converts TSP exactly once before calculating AM", () => {
    const pm10 = calculateAdditionalMortality(0.1, 100, 50000, "pm10");
    expect(pm10.pm10Concentration).toBe(0.1);
    expect(pm10.irm).toBeCloseTo(2.7397260273972602e-8, 15);
    expect(pm10.sf).toBeCloseTo(0.0007, 12);
    expect(pm10.am).toBeCloseTo(3.5, 12);
    expect(pm10.amPer10000).toBeCloseTo(0.7, 12);
    const tsp = calculateAdditionalMortality(0.1, 100, 50000, "tsp");
    expect(tsp.pm10Concentration).toBe(0.06);
    expect(tsp.am).toBeCloseTo(2.1, 12);
    expect(tsp.amPer10000).toBeCloseTo(0.42, 12);
    expect(tsp).toEqual(calculateAdditionalMortality(0.06, 100, 50000, "pm10"));
  });

  it("formats very small table values in scientific notation", () => {
    expect(formatNumber(0.001)).toBe("1e-3");
    expect(formatNumber(0.01)).toBe("0.01");
    expect(formatNumber(0.00001234)).toBe("1.234e-5");
  });

  it("hides binary floating point tails", () => {
    expect(normalizeNumber(0.0100000000002)).toBe(0.01);
    expect(formatNumber(0.0100000000002)).toBe("0.01");
    expect(formatNumber(12.345678901)).toBe("12.345679");
  });
});


describe("number locale", () => {
  it.each([0.01234, 0.00001234, -0.00001234, 123.456, 12345678.9])("uses the chosen separator in ordinary and scientific values: %s", value => {
    const en = formatNumber(value, 8, "en");
    const ua = formatNumber(value, 8, "ua");
    expect(ua).toBe(en.replace(".", ","));
    expect(en).not.toContain(",");
    expect(ua).not.toContain(".");
  });
  it("keeps zero and invalid values stable in either locale", () => {
    expect(formatNumber(0, 8, "ua")).toBe("0");
    expect(formatNumber(NaN, 8, "ua")).toBe("—");
    expect(formatNumber(Infinity)).toBe("—");
  });
});
