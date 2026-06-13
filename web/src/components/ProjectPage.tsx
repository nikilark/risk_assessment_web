import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { applyCatalogMode, createId } from "../domain/project";
import { formatNumber, normalizeNumber } from "../domain/risk";
import type { AgentRecord, ProjectFile } from "../domain/types";
import { OrganChips, OrganIconLegend, OrganToggleGroup } from "./OrganChips";

type AgentDraft = {
  name: string;
  cas: string;
  dangerClass: string;
  rfcLifelong: string;
  affectedOrgansLifelong: string[];
  rfcAcute: string;
  affectedOrgansAcute: string[];
  sfi: string;
};

const emptyDraft: AgentDraft = {
  name: "",
  cas: "",
  dangerClass: "",
  rfcLifelong: "",
  affectedOrgansLifelong: [],
  rfcAcute: "",
  affectedOrgansAcute: [],
  sfi: ""
};

function numeric(value: string): number {
  return normalizeNumber(Number(value) || 0);
}

export function ProjectPage({ project, updateProject }: { project: ProjectFile; updateProject: (project: ProjectFile) => void }) {
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<AgentDraft>(emptyDraft);
  const researchType = project.project.research_type;
  const shownAgents = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("uk-UA");
    return project.project.agents
      .filter((agent) => {
        const relevant =
          ((researchType.cancer_lifelong || researchType.cancer_acute) && agent.sfi > 0) ||
          (researchType.non_cancer_lifelong && agent.rfcLifelong > 0) ||
          (researchType.non_cancer_acute && agent.rfcAcute > 0) ||
          (researchType.suspended_particles && agent.name.toLocaleLowerCase("uk-UA").includes("част"));
        return relevant && (!normalized || agent.name.toLocaleLowerCase("uk-UA").includes(normalized));
      })
      .sort((a, b) => a.name.localeCompare(b.name, "uk-UA"));
  }, [project.project.agents, query, researchType]);

  const patchType = (key: keyof typeof researchType, value: boolean) =>
    updateProject({ ...project, project: { ...project.project, research_type: { ...researchType, [key]: value } } });

  const setCancerEnabled = (enabled: boolean) =>
    updateProject({
      ...project,
      project: {
        ...project.project,
        research_type: {
          ...researchType,
          cancer_lifelong: enabled ? (researchType.cancer_lifelong || !researchType.cancer_acute) : false,
          cancer_acute: enabled ? researchType.cancer_acute : false
        }
      }
    });

  const setNonCancerEnabled = (enabled: boolean) =>
    updateProject({
      ...project,
      project: {
        ...project.project,
        research_type: {
          ...researchType,
          non_cancer_lifelong: enabled ? (researchType.non_cancer_lifelong || !researchType.non_cancer_acute) : false,
          non_cancer_acute: enabled ? researchType.non_cancer_acute : false
        }
      }
    });

  const updateAgent = (id: string, selected: boolean) =>
    updateProject({
      ...project,
      project: { ...project.project, agents: project.project.agents.map((agent) => (agent.id === id ? { ...agent, selected } : agent)) }
    });

  const setExpandedCatalog = (expandedCatalog: boolean) => updateProject(applyCatalogMode(project, expandedCatalog));

  const addAgent = () => {
    if (!draft.name?.trim()) return;
    const agent: AgentRecord = {
      id: createId("agent"),
      name: draft.name.trim(),
      cas: draft.cas.trim(),
      dangerClass: numeric(draft.dangerClass),
      rfcLifelong: numeric(draft.rfcLifelong),
      affectedOrgansLifelong: draft.affectedOrgansLifelong,
      rfcAcute: numeric(draft.rfcAcute),
      affectedOrgansAcute: draft.affectedOrgansAcute,
      sfi: numeric(draft.sfi),
      selected: true,
      source: "manual",
      reviewStatus: "user_added"
    };
    updateProject({ ...project, project: { ...project.project, agents: [...project.project.agents, agent] } });
    setDraft(emptyDraft);
  };

  return (
    <section className="page project-page">
      <input
        className="title-input"
        value={project.project.title}
        onChange={(event) => updateProject({ ...project, project: { ...project.project, title: event.target.value } })}
        aria-label="Назва проєкту"
      />

      <div className="research-switches" aria-label="Типи дослідження">
        <div className={`switch-card ${researchType.cancer_lifelong || researchType.cancer_acute ? "active" : ""}`}>
          <label className="switch-line">
            <span>Канцерогенний ризик</span>
            <input className="toggle-input" type="checkbox" checked={researchType.cancer_lifelong || researchType.cancer_acute} onChange={(event) => setCancerEnabled(event.target.checked)} />
          </label>
          {(researchType.cancer_lifelong || researchType.cancer_acute) && (
            <div className="subtype-switches">
              <label><input className="toggle-input small" type="checkbox" checked={researchType.cancer_lifelong} onChange={(event) => patchType("cancer_lifelong", event.target.checked)} /> Хронічний</label>
              <label><input className="toggle-input small" type="checkbox" checked={researchType.cancer_acute} onChange={(event) => patchType("cancer_acute", event.target.checked)} /> Гострий</label>
            </div>
          )}
        </div>
        <div className={`switch-card ${researchType.non_cancer_lifelong || researchType.non_cancer_acute ? "active" : ""}`}>
          <label className="switch-line">
            <span>Неканцерогенний ризик</span>
            <input className="toggle-input" type="checkbox" checked={researchType.non_cancer_lifelong || researchType.non_cancer_acute} onChange={(event) => setNonCancerEnabled(event.target.checked)} />
          </label>
          {(researchType.non_cancer_lifelong || researchType.non_cancer_acute) && (
            <div className="subtype-switches">
              <label><input className="toggle-input small" type="checkbox" checked={researchType.non_cancer_lifelong} onChange={(event) => patchType("non_cancer_lifelong", event.target.checked)} /> Хронічний</label>
              <label><input className="toggle-input small" type="checkbox" checked={researchType.non_cancer_acute} onChange={(event) => patchType("non_cancer_acute", event.target.checked)} /> Гострий</label>
            </div>
          )}
        </div>
        <label className={`switch-card single ${researchType.suspended_particles ? "active" : ""}`}>
          <span>Зважені частинки</span>
          <input className="toggle-input" type="checkbox" checked={researchType.suspended_particles} onChange={(event) => patchType("suspended_particles", event.target.checked)} />
        </label>
      </div>

      <div className="toolbar">
        <div className="muted">{shownAgents.filter((agent) => agent.selected).length}/{shownAgents.length} обрано в поточному фільтрі</div>
        <div className="toolbar-actions">
          <label className="search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Пошук речовини" /></label>
          <label className="catalog-toggle">
            <span>Розширений список</span>
            <input className="toggle-input" type="checkbox" checked={project.settings.expandedCatalog} onChange={(event) => setExpandedCatalog(event.target.checked)} />
          </label>
        </div>
      </div>

      <div className="table-wrap agents-table">
        <table className="data-table">
          <thead>
            <tr>
              <th>Обрано</th>
              <th>Назва</th>
              <th>CAS</th>
              <th>RFC</th>
              <th>Органи RFC</th>
              <th>ARFC</th>
              <th>Органи ARFC</th>
              <th>SFi</th>
            </tr>
          </thead>
          <tbody>
            {shownAgents.map((agent) => (
              <tr key={agent.id}>
                <td><input type="checkbox" checked={Boolean(agent.selected)} onChange={(event) => updateAgent(agent.id, event.target.checked)} /></td>
                <td>{agent.name}</td>
                <td>{agent.cas || "—"}</td>
                <td>{agent.rfcLifelong ? formatNumber(agent.rfcLifelong) : "—"}</td>
                <td><OrganChips organs={agent.affectedOrgansLifelong} compact /></td>
                <td>{agent.rfcAcute ? formatNumber(agent.rfcAcute) : "—"}</td>
                <td><OrganChips organs={agent.affectedOrgansAcute} compact /></td>
                <td>{agent.sfi ? formatNumber(agent.sfi) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel add-agent">
        <h3>Додати речовину</h3>
        <div className="form-grid">
          <input placeholder="Назва речовини" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          <input placeholder="CAS" value={draft.cas} onChange={(event) => setDraft({ ...draft, cas: event.target.value })} />
          <input type="number" placeholder="Клас небезпеки" value={draft.dangerClass} onChange={(event) => setDraft({ ...draft, dangerClass: event.target.value })} />
          <input type="number" placeholder="RFC хронічний" value={draft.rfcLifelong} onChange={(event) => setDraft({ ...draft, rfcLifelong: event.target.value })} />
          <input type="number" placeholder="ARFC гострий" value={draft.rfcAcute} onChange={(event) => setDraft({ ...draft, rfcAcute: event.target.value })} />
          <input type="number" placeholder="SFi" value={draft.sfi} onChange={(event) => setDraft({ ...draft, sfi: event.target.value })} />
          <OrganToggleGroup label="Органи ураження для RFC" selected={draft.affectedOrgansLifelong} onChange={(affectedOrgansLifelong) => setDraft({ ...draft, affectedOrgansLifelong })} />
          <OrganToggleGroup label="Органи ураження для ARFC" selected={draft.affectedOrgansAcute} onChange={(affectedOrgansAcute) => setDraft({ ...draft, affectedOrgansAcute })} />
          <button className="primary" onClick={addAgent}><Plus size={16} /> Додати</button>
        </div>
      </div>

      <OrganIconLegend />
    </section>
  );
}
