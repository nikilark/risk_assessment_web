import { FileDown, FileUp, Monitor, Moon, RotateCcw, Sun } from "lucide-react";
import { clearAutosave } from "../storage/db";
import { exportProject, readJsonFile } from "../domain/files";
import { normalizeProject } from "../domain/project";
import type { ProjectFile, ThemeMode } from "../domain/types";

export function SettingsPage({
  project,
  updateProject,
  resetProject
}: {
  project: ProjectFile;
  updateProject: (project: ProjectFile) => void;
  resetProject: () => void;
}) {
  const importProject = async (file: File) => {
    const data = await readJsonFile<unknown>(file);
    updateProject(normalizeProject(data));
  };

  const resetAll = async () => {
    await clearAutosave();
    resetProject();
  };

  const setTheme = (theme: ThemeMode) => updateProject({ ...project, settings: { ...project.settings, theme } });

  return (
    <section className="page settings-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">сервіс</p>
          <h1>Налаштування</h1>
        </div>
      </div>

      <div className="settings-grid">
        <div className="panel">
          <h3>Проєкт</h3>
          <div className="button-stack">
            <button className="secondary" onClick={() => exportProject(project)}><FileDown size={16} /> Зберегти JSON</button>
            <label className="file-button"><FileUp size={16} /> Відкрити JSON<input type="file" accept="application/json,.json" onChange={(event) => event.target.files?.[0] && importProject(event.target.files[0])} /></label>
            <button className="danger" onClick={resetAll}><RotateCcw size={16} /> Новий проєкт</button>
          </div>
        </div>

        <div className="panel">
          <h3>Оформлення</h3>
          <div className="theme-toggle" role="group" aria-label="Тема інтерфейсу">
            <button className={project.settings.theme === "system" ? "active" : ""} onClick={() => setTheme("system")}><Monitor size={17} /> Система</button>
            <button className={project.settings.theme === "light" ? "active" : ""} onClick={() => setTheme("light")}><Sun size={17} /> Світла</button>
            <button className={project.settings.theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}><Moon size={17} /> Темна</button>
          </div>
          <div className="color-grid">
            <label>
              <span>Основний колір</span>
              <input type="color" value={project.settings.primaryColor} onChange={(event) => updateProject({ ...project, settings: { ...project.settings, primaryColor: event.target.value } })} />
            </label>
            <label>
              <span>Акцент</span>
              <input type="color" value={project.settings.accentColor} onChange={(event) => updateProject({ ...project, settings: { ...project.settings, accentColor: event.target.value } })} />
            </label>
          </div>
          <div className="color-preview" aria-label="Попередній перегляд кольорів">
            <span style={{ background: project.settings.primaryColor }}>Основний</span>
            <span style={{ background: project.settings.accentColor }}>Акцент</span>
          </div>
        </div>
      </div>
    </section>
  );
}
