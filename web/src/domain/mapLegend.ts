import type { PlaceScale, RiskLevel } from "./types";

export const placeScaleLabels: Record<PlaceScale, string> = {
  street: "вулиця",
  district: "район",
  city: "місто",
  region: "регіон"
};

export const mapMarkerRadii: Record<PlaceScale, number> = {
  street: 7,
  district: 11,
  city: 15,
  region: 21
};

export const mapExportMarkerRadii: Record<PlaceScale, number> = {
  street: 9,
  district: 14,
  city: 19,
  region: 26
};

export const riskLevelOrder: RiskLevel[] = ["minimal", "low", "medium", "high", "critical"];
