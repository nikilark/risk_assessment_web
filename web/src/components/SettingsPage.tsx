import { FileDown, FileUp, Monitor, Moon, RotateCcw, Sun } from "lucide-react";
import { useState } from "react";
import { clearAutosave } from "../storage/db";
import { exportProject, readJsonFile } from "../domain/files";
import { normalizeProject } from "../domain/project";
import type { NumberLocale, ProjectFile, ThemeMode } from "../domain/types";

function previewTextColor(background: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(background)) return "var(--text)";
  const channels = background.slice(1).match(/.{2}/g)!.map((value) => parseInt(value, 16) / 255);
  const luminance = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  return luminance > 0.179 ? "#000000" : "#ffffff";
}

export function SettingsPage({
  project,
  updateProject,
  resetProject
}: {
  project: ProjectFile;
  updateProject: (project: ProjectFile) => void;
  resetProject: () => void;
}) {
  const [importError, setImportError] = useState<string | null>(null);
  const importProject = async (file: File) => {
    setImportError(null);
    try {
      const data = await readJsonFile<unknown>(file);
      updateProject(normalizeProject(data));
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Не вдалося відкрити проєкт.");
    }
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
            <label className="file-button"><FileUp size={16} /> Відкрити JSON<input type="file" accept="application/json,.json" onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void importProject(file);
            }} /></label>
            <button className="danger" onClick={resetAll}><RotateCcw size={16} /> Новий проєкт</button>
          </div>
          {importError && <p role="alert">{importError}</p>}
          <label className="field-label project-number-format">
            <span>Формат чисел</span>
            <select aria-label="Формат чисел" value={project.settings.locale} onChange={(event) => updateProject({ ...project,
              settings: { ...project.settings, locale: event.target.value as NumberLocale } })}>
              <option value="en">en — крапка (1.23)</option>
              <option value="ua">ua — кома (1,23)</option>
            </select>
          </label>
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
            <span style={{ background: project.settings.primaryColor, color: previewTextColor(project.settings.primaryColor) }}>Основний</span>
            <span style={{ background: project.settings.accentColor, color: previewTextColor(project.settings.accentColor) }}>Акцент</span>
          </div>
        </div>
      </div>
    </section>
  );
}
