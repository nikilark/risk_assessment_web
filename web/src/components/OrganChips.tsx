import {
  Activity,
  Baby,
  Bean,
  Bone,
  Brain,
  CircleDot,
  Dna,
  Droplet,
  Eye,
  FlaskConical,
  HandHeart,
  HeartPulse,
  Microscope,
  Shield,
  Stethoscope,
  Waves,
  Wind,
  type LucideIcon
} from "lucide-react";

export const commonOrgans = [
  "органи дихання",
  "центральна нервова система",
  "органи зору",
  "печінка",
  "нирки",
  "кровоносна система",
  "серцево-судинна система",
  "репродуктивна система",
  "ендокринна система",
  "імунна система",
  "шлунково-кишковий тракт",
  "кісткова система",
  "вроджені вади розвитку",
  "мутаген.",
  "слизові"
];

function normalizeOrgan(value: string): string {
  return value.trim().toLocaleLowerCase("uk-UA");
}

export function iconForOrgan(value: string): LucideIcon {
  const organ = normalizeOrgan(value);
  if (organ.includes("дих")) return Wind;
  if (organ.includes("нерв")) return Brain;
  if (organ.includes("зору")) return Eye;
  if (organ.includes("печін")) return FlaskConical;
  if (organ.includes("нир")) return Bean;
  if (organ.includes("кров")) return Droplet;
  if (organ.includes("серцев")) return HeartPulse;
  if (organ.includes("репроду")) return Dna;
  if (organ.includes("ендокрин")) return CircleDot;
  if (organ.includes("імун")) return Shield;
  if (organ.includes("шлунково")) return Stethoscope;
  if (organ.includes("кіст")) return Bone;
  if (organ.includes("вроджен")) return Baby;
  if (organ.includes("мутаген")) return Microscope;
  if (organ.includes("слиз")) return Waves;
  if (organ.includes("м’яз") || organ.includes("м'яз")) return Activity;
  return HandHeart;
}

export function splitOrganCell(value: string): string[] {
  if (!value || value === "—") return [];
  return value.split(/[,;]/).map((item) => item.trim()).filter(Boolean);
}

export function OrganChips({ organs, compact = false }: { organs: string[]; compact?: boolean }) {
  if (!organs.length) return <span className="muted">—</span>;
  return (
    <span className={`organ-chips ${compact ? "compact" : ""}`}>
      {organs.map((organ) => {
        const Icon = iconForOrgan(organ);
        return (
          <span className="organ-chip" title={organ} key={organ}>
            <Icon size={compact ? 14 : 15} />
            {!compact && <span>{organ}</span>}
          </span>
        );
      })}
    </span>
  );
}

export function OrganToggleGroup({
  label,
  selected,
  onChange
}: {
  label: string;
  selected: string[];
  onChange: (organs: string[]) => void;
}) {
  const toggle = (organ: string) => {
    onChange(selected.includes(organ) ? selected.filter((item) => item !== organ) : [...selected, organ]);
  };

  return (
    <fieldset className="organ-toggle-group">
      <legend>{label}</legend>
      <div>
        {commonOrgans.map((organ) => {
          const Icon = iconForOrgan(organ);
          const active = selected.includes(organ);
          return (
            <button type="button" className={`organ-toggle ${active ? "active" : ""}`} onClick={() => toggle(organ)} title={organ} key={organ}>
              <Icon size={16} />
              <span className="sr-only">{organ}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function OrganIconLegend() {
  return (
    <details className="organ-legend">
      <summary>Легенда іконок органів</summary>
      <div className="organ-legend-grid">
        {commonOrgans.map((organ) => {
          const Icon = iconForOrgan(organ);
          return (
            <span className="organ-legend-item" key={organ}>
              <Icon size={16} />
              <span>{organ}</span>
            </span>
          );
        })}
      </div>
    </details>
  );
}
