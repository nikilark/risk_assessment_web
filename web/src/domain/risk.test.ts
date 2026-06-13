import { describe, expect, it } from "vitest";
import { calculateAdditionalMortality, calculateCancer, calculateHazardQuotient, cancerRiskLevel, formatNumber, hazardRiskLevel } from "./risk";

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

  it("calculates particulate mortality values", () => {
    const risk = calculateAdditionalMortality(0.2, 100, 50000);
    expect(risk.irm).toBeGreaterThan(0);
    expect(risk.sf).toBeGreaterThan(0);
    expect(risk.amPer10000).toBeCloseTo(risk.am / 50000 * 10000);
  });

  it("formats very small table values in scientific notation", () => {
    expect(formatNumber(0.001)).toBe("1e-3");
    expect(formatNumber(0.01)).toBe("0,01");
    expect(formatNumber(0.00001234)).toBe("1.234e-5");
  });
});
