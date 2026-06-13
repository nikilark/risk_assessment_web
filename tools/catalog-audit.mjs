import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, "..");
const sourcePath = path.join(root, "research.json");
const webSrcData = path.join(root, "web", "src", "data");
const webPublicCatalogs = path.join(root, "web", "public", "catalogs");

const commonNames = new Set([
  "Азоту діоксид",
  "Азоту оксид",
  "Аміак",
  "Бензол",
  "Водень сульфід",
  "Водень фтористий",
  "Водень хлорид",
  "Вуглецю оксид",
  "Зважені частинки (TSP)",
  "Завислі частинки (РМ10)",
  "Завислі частинки (РМ2.5)",
  "Кадмій та сполуки",
  "Ксилоли",
  "Марганець та сполуки",
  "Миш’як",
  "Нікель",
  "Озон",
  "Свинець та його неорганічні сполуки",
  "Сірки діоксид",
  "Стирол",
  "Толуол",
  "Фенол",
  "Формальдегід",
  "Хлор",
  "Хлороформ",
  "Хром (VI)",
  "Епіхлоргідрин",
  "Акролеїн",
  "Акрилонітрил",
  "Ацетальдегід",
  "Вінілхлорид",
  "Етиленбензол",
  "Тетрахлоретилен",
  "Трихлоретилен"
]);

const casOverrides = new Map([
  ["Акролеїн", "107-02-8"],
  ["Вінілхлорид", "75-01-4"],
  ["Водень сульфід", "7783-06-4"],
  ["Сірки діоксид", "7446-09-5"],
  ["Хлор", "7782-50-5"],
  ["Формальдегід", "50-00-0"],
  ["Епіхлоргідрин", "106-89-8"],
  ["Трихлоретилен", "79-01-6"],
  ["Етиленбензол", "100-41-4"]
]);

function normalizeName(value) {
  return String(value).trim().toLocaleLowerCase("uk-UA").replace(/\s+/g, " ");
}

function repairCas(value) {
  const cas = String(value ?? "").trim();
  if (!cas) return "";
  if (/^\d{1,7}-\d{2}-\d$/.test(cas)) return cas;
  const match = cas.match(/^(\d{4,5})-(\d{2})-(\d{2})$/);
  if (!match) return cas;
  let [, first, middle, last] = match;
  if (first.startsWith("19")) first = first.slice(2);
  first = first.replace(/^0+/, "") || "0";
  last = last.replace(/^0+/, "") || "0";
  return `${first}-${middle}-${last}`;
}

function casChecksumValid(cas) {
  if (!/^\d{1,7}-\d{2}-\d$/.test(cas)) return false;
  const digits = cas.replaceAll("-", "");
  const check = Number(digits.at(-1));
  const body = digits.slice(0, -1).split("").reverse().map(Number);
  const sum = body.reduce((acc, digit, index) => acc + digit * (index + 1), 0);
  return sum % 10 === check;
}

function asAgent(raw, index) {
  const name = String(raw.name ?? "").trim();
  const overriddenCas = casOverrides.get(name);
  const repairedCas = overriddenCas ?? repairCas(raw.cas);
  const originalCas = String(raw.cas ?? "").trim();
  const reviewStatus = overriddenCas
    ? "cas_corrected"
    : originalCas !== repairedCas
      ? "cas_repaired"
      : casChecksumValid(repairedCas) || repairedCas === ""
        ? "source_shape_ok"
        : "needs_source_review";
  return {
    id: `source-${index + 1}`,
    name,
    cas: repairedCas,
    originalCas,
    dangerClass: Number(raw.danger_class ?? 0),
    rfcLifelong: Number(raw.rfc_lifelong ?? 0),
    affectedOrgansLifelong: Array.isArray(raw.affected_organs_lifelong) ? raw.affected_organs_lifelong : [],
    rfcAcute: Number(raw.rfc_acute ?? 0),
    affectedOrgansAcute: Array.isArray(raw.affected_organs_acute) ? raw.affected_organs_acute : [],
    sfi: Number(raw.sfi ?? 0),
    source: "research.json source snapshot; toxicity values require source verification",
    reviewStatus
  };
}

const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const rawAgents = source?.agents?.agents ?? [];
const audited = rawAgents.map(asAgent);
const byName = new Map();
const byCas = new Map();
for (const agent of audited) {
  const nameKey = normalizeName(agent.name);
  byName.set(nameKey, [...(byName.get(nameKey) ?? []), agent.id]);
  if (agent.cas) byCas.set(agent.cas, [...(byCas.get(agent.cas) ?? []), agent.id]);
}

const preferredByName = new Map();
for (const agent of audited) {
  const key = normalizeName(agent.name);
  const existing = preferredByName.get(key);
  const score = (agent.rfcLifelong > 0 ? 2 : 0) + (agent.rfcAcute > 0 ? 2 : 0) + (agent.sfi > 0 ? 1 : 0);
  const existingScore = existing
    ? (existing.rfcLifelong > 0 ? 2 : 0) + (existing.rfcAcute > 0 ? 2 : 0) + (existing.sfi > 0 ? 1 : 0)
    : -1;
  if (!existing || score > existingScore) preferredByName.set(key, agent);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "uk-UA"));
}

function mergeCatalogAgent(name, idPrefix) {
  const records = audited.filter((agent) => normalizeName(agent.name) === normalizeName(name));
  if (records.length === 0) return null;
  const preferred = preferredByName.get(normalizeName(name)) ?? records[0];
  const overriddenCas = casOverrides.get(preferred.name);
  const cas = overriddenCas ?? records.find((agent) => casChecksumValid(agent.cas))?.cas ?? repairCas(preferred.cas);
  const dangerClasses = records.map((agent) => agent.dangerClass).filter((value) => value > 0);
  return {
    id: `${idPrefix}-${preferred.id.replace(/^source-/, "")}`,
    name: preferred.name,
    cas,
    dangerClass: dangerClasses.length ? Math.min(...dangerClasses) : 0,
    rfcLifelong: Math.max(...records.map((agent) => agent.rfcLifelong)),
    affectedOrgansLifelong: unique(records.flatMap((agent) => agent.affectedOrgansLifelong)),
    rfcAcute: Math.max(...records.map((agent) => agent.rfcAcute)),
    affectedOrgansAcute: unique(records.flatMap((agent) => agent.affectedOrgansAcute)),
    sfi: Math.max(...records.map((agent) => agent.sfi))
  };
}

const defaultAgents = [...commonNames]
  .map((name) => mergeCatalogAgent(name, "basic"))
  .filter(Boolean)
  .sort((a, b) => a.name.localeCompare(b.name, "uk-UA"));

const expandedCatalogNames = [...preferredByName.values()]
  .map((agent) => agent.name)
  .sort((a, b) => a.localeCompare(b, "uk-UA"));

const expandedCatalog = expandedCatalogNames
  .map((name) => mergeCatalogAgent(name, "expanded"))
  .filter(Boolean)
  .sort((a, b) => a.name.localeCompare(b.name, "uk-UA"));

const audit = {
  generatedAt: new Date().toISOString(),
  source: "research.json",
  totalAgents: audited.length,
  defaultAgents: defaultAgents.length,
  duplicateNames: [...byName.entries()].filter(([, ids]) => ids.length > 1).map(([name, ids]) => ({ name, ids })),
  duplicateCas: [...byCas.entries()].filter(([, ids]) => ids.length > 1).map(([cas, ids]) => ({ cas, ids })),
  invalidCas: audited.filter((agent) => agent.cas && !casChecksumValid(agent.cas)).map((agent) => ({
    id: agent.id,
    name: agent.name,
    cas: agent.cas,
    originalCas: agent.originalCas
  })),
  notes: [
    "Basic catalog is intentionally compact and focused on common ambient air pollutants.",
    "Expanded catalog is deduplicated by substance name from the source snapshot."
  ]
};

fs.mkdirSync(webSrcData, { recursive: true });
fs.writeFileSync(path.join(webSrcData, "default-agents.json"), `${JSON.stringify(defaultAgents, null, 2)}\n`);
fs.writeFileSync(path.join(webSrcData, "expanded-agents.json"), `${JSON.stringify(expandedCatalog, null, 2)}\n`);
fs.rmSync(webPublicCatalogs, { recursive: true, force: true });

console.log(`Audited ${audited.length} source records; wrote ${defaultAgents.length} basic agents and ${expandedCatalog.length} expanded agents.`);
console.log(`Source notes: ${audit.duplicateNames.length} duplicate names, ${audit.duplicateCas.length} duplicate CAS values, ${audit.invalidCas.length} CAS values still need source review.`);
