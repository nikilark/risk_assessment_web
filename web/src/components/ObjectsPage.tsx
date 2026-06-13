import { Map, Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { createId } from "../domain/project";
import type { AgentRecord, PlaceScale, ProjectFile, ResearchObject, ResearchType } from "../domain/types";
import { MapPicker } from "./MapPanel";

const scaleLabels: Record<PlaceScale, string> = {
  street: "вулиця",
  district: "район",
  city: "місто",
  region: "регіон"
};

const scaleDefaults: Record<PlaceScale, { population: number; deaths: number }> = {
  street: { population: 100, deaths: 1 },
  district: { population: 10_000, deaths: 120 },
  city: { population: 100_000, deaths: 1_200 },
  region: { population: 1_000_000, deaths: 12_000 }
};

const defaultDraft = {
  title: "",
  population: scaleDefaults.street.population,
  deaths: scaleDefaults.street.deaths
};

function defaultConcentration(agent: AgentRecord, researchType: ResearchType): number {
  const values: number[] = [];
  if (researchType.non_cancer_lifelong && agent.rfcLifelong > 0) values.push(agent.rfcLifelong * 0.1);
  if (researchType.non_cancer_acute && agent.rfcAcute > 0) values.push(agent.rfcAcute * 0.1);
  if (researchType.suspended_particles && agent.name.toLocaleLowerCase("uk-UA").includes("част")) values.push(0.01);
  if ((researchType.cancer_lifelong || researchType.cancer_acute) && agent.sfi > 0) values.push(0.001);
  return values.length ? Math.min(...values) : 0.001;
}

export function ObjectsPage({ project, updateProject }: { project: ProjectFile; updateProject: (project: ProjectFile) => void }) {
  const [draft, setDraft] = useState(defaultDraft);
  const [coordinate, setCoordinate] = useState<ResearchObject["coordinate"]>();
  const [showMap, setShowMap] = useState(false);
  const titleTouched = useRef(false);
  const populationTouched = useRef(false);
  const deathsTouched = useRef(false);
  const selectedAgents = useMemo(() => project.project.agents.filter((agent) => agent.selected), [project.project.agents]);

  const getExposure = (objectId: string, agentId: string) =>
    project.research.exposures.find((exposure) => exposure.objectId === objectId && exposure.agentId === agentId)?.concentration ?? 0;

  const setExposure = (objectId: string, agentId: string, concentration: number) => {
    const rest = project.research.exposures.filter((exposure) => !(exposure.objectId === objectId && exposure.agentId === agentId));
    updateProject({
      ...project,
      research: {
        ...project.research,
        exposures: [...rest, { objectId, agentId, concentration: Math.max(0, concentration) }]
      }
    });
  };

  const addObject = () => {
    if (!draft.title.trim()) return;
    const objectId = createId("object");
    const object: ResearchObject = {
      id: objectId,
      title: draft.title.trim(),
      population: Math.max(1, Number(draft.population) || scaleDefaults.street.population),
      deaths: Math.max(0, Number(draft.deaths) || 0),
      coordinate
    };
    const defaultExposures = selectedAgents.map((agent) => ({
      objectId,
      agentId: agent.id,
      concentration: defaultConcentration(agent, project.project.research_type)
    }));
    updateProject({
      ...project,
      research: {
        ...project.research,
        points: [...project.research.points, object],
        exposures: [...project.research.exposures, ...defaultExposures]
      }
    });
    setDraft(defaultDraft);
    setCoordinate(undefined);
    titleTouched.current = false;
    populationTouched.current = false;
    deathsTouched.current = false;
  };

  const removeObject = (id: string) =>
    updateProject({
      ...project,
      research: {
        points: project.research.points.filter((object) => object.id !== id),
        exposures: project.research.exposures.filter((exposure) => exposure.objectId !== id)
      }
    });

  const onPick = useCallback((picked: { latitude: number; longitude: number; title?: string; scale?: PlaceScale }) => {
    setCoordinate({ latitude: picked.latitude, longitude: picked.longitude, scale: picked.scale });
    const defaults = scaleDefaults[picked.scale ?? "street"];
    if (!titleTouched.current && picked.title) {
      setDraft((current) => ({ ...current, title: picked.title ?? current.title }));
    }
    setDraft((current) => ({
      ...current,
      population: populationTouched.current ? current.population : defaults.population,
      deaths: deathsTouched.current ? current.deaths : defaults.deaths
    }));
  }, []);

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">крок 2</p>
          <h1>Об'єкти</h1>
        </div>
        <button className="secondary" onClick={() => setShowMap((value) => !value)}><Map size={16} /> {showMap ? "Сховати мапу" : "Обрати на мапі"}</button>
      </div>

      {showMap && (
        <div className="panel">
          <p className="muted">Мапа використовує онлайн-тайли OpenStreetMap. Після кліку координати підставляться в новий об'єкт.</p>
          <MapPicker objects={project.research.points} onPick={onPick} />
        </div>
      )}

      <div className="panel">
        <h3>Новий об'єкт</h3>
        <div className="form-grid object-form">
          <label className="field-label">
            <span>Назва об'єкта</span>
            <input placeholder="Наприклад: вул. Хрещатик / Київ / Львівська область" value={draft.title} onChange={(event) => { titleTouched.current = true; setDraft({ ...draft, title: event.target.value }); }} />
          </label>
          <label className="field-label">
            <span>Населення</span>
            <input type="number" min={1} placeholder="100" value={draft.population} onChange={(event) => { populationTouched.current = true; setDraft({ ...draft, population: Number(event.target.value) }); }} />
          </label>
          {project.project.research_type.suspended_particles && (
            <label className="field-label">
              <span>Випадки смерті</span>
              <input type="number" min={0} placeholder="1" value={draft.deaths} onChange={(event) => { deathsTouched.current = true; setDraft({ ...draft, deaths: Number(event.target.value) }); }} />
            </label>
          )}
          <div className="coordinate-box">
            {coordinate ? `${coordinate.latitude.toFixed(5)}, ${coordinate.longitude.toFixed(5)}${coordinate.scale ? ` · ${scaleLabels[coordinate.scale]}` : ""}` : "Координати не задані"}
          </div>
          <button className="primary" onClick={addObject}><Plus size={16} /> Додати</button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table exposure-table">
          <thead>
            <tr>
              <th>Назва</th>
              <th>Населення</th>
              {project.project.research_type.suspended_particles && <th>Випадки смерті</th>}
              {selectedAgents.map((agent) => <th key={agent.id}>{agent.name}</th>)}
              <th>Дії</th>
            </tr>
          </thead>
          <tbody>
            {project.research.points.map((object) => (
              <tr key={object.id}>
                <td>{object.title}</td>
                <td>{object.population.toLocaleString("uk-UA")}</td>
                {project.project.research_type.suspended_particles && <td>{object.deaths.toLocaleString("uk-UA")}</td>}
                {selectedAgents.map((agent) => (
                  <td key={agent.id}>
                    <input
                      className="cell-input"
                      type="number"
                      min={0}
                      step="any"
                      value={getExposure(object.id, agent.id)}
                      onChange={(event) => setExposure(object.id, agent.id, Number(event.target.value))}
                      placeholder={String(defaultConcentration(agent, project.project.research_type))}
                      aria-label={`${object.title} ${agent.name}`}
                    />
                  </td>
                ))}
                <td><button className="ghost" onClick={() => removeObject(object.id)} title="Видалити"><Trash2 size={16} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
