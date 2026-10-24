import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ObjectsPage } from "./components/ObjectsPage";
import { ProjectPage } from "./components/ProjectPage";
import { ReportPage } from "./components/ReportPage";
import { ResultsPage } from "./components/ResultsPage";
import { SettingsPage } from "./components/SettingsPage";
import { Sidebar } from "./components/Sidebar";
import { Toast } from "./components/Toast";
import { createDefaultProject, normalizeProject } from "./domain/project";
import { generateResults } from "./domain/results";
import type { ProjectFile } from "./domain/types";
import { loadAutosave, saveAutosave } from "./storage/db";

export type PageKey = "project" | "objects" | "results" | "report" | "settings";

const helpText: Record<PageKey, string> = {
  project: "Задайте назву, увімкніть потрібні типи розрахунку та оберіть речовини з базового або розширеного каталогу.",
  objects: "Додайте об'єкти вручну або з онлайн-мапи, після чого введіть концентрації в одній таблиці. На мапі можна тимчасово показати ймовірні промислові джерела з OpenStreetMap.",
  results: "Оберіть показник, об'єкти, речовини та роки в панелі порівняння. Таблицю, графік і мапу можна окремо скопіювати, зберегти або додати до звіту. Для мапи оберіть рік і речовину або орган.",
  report: "Редагуйте текстові секції, переглядайте додані таблиці, графіки й мапи та використовуйте друк браузера для PDF.",
  settings: "Імпорт/експорт проєктів, базовий або розширений каталог речовин, тема та кольори інтерфейсу."
};

export default function App() {
  const [project, setProject] = useState<ProjectFile>(() => createDefaultProject());
  const [page, setPage] = useState<PageKey>("project");
  const [loaded, setLoaded] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem("risk-assessment-sidebar-collapsed");
      if (saved !== null) return saved === "true";
    } catch { /* Layout preferences are optional when browser storage is unavailable. */ }
    return window.matchMedia("(max-width: 1100px)").matches;
  });
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null);
  const showToast = (message: string) => setToast((previous) => ({ message, id: (previous?.id ?? 0) + 1 }));
  const dismissToast = useCallback(() => setToast(null), []);
  const [availableHighlights, setAvailableHighlights] = useState<Partial<Record<PageKey, boolean>>>({});
  const previousEnabled = useRef<Partial<Record<PageKey, boolean>>>({});
  const results = useMemo(() => generateResults(project), [project]);

  useEffect(() => {
    try { localStorage.setItem("risk-assessment-sidebar-collapsed", String(sidebarCollapsed)); }
    catch { /* Navigation still works without persistent browser storage. */ }
  }, [sidebarCollapsed]);

  useEffect(() => {
    loadAutosave().then((saved) => {
      if (saved) setProject(normalizeProject(saved));
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const handle = window.setTimeout(() => saveAutosave(project), 300);
    return () => window.clearTimeout(handle);
  }, [loaded, project]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const theme = project.settings.theme === "system" ? (media.matches ? "dark" : "light") : project.settings.theme;
      document.documentElement.dataset.theme = theme;
    };
    applyTheme();
    document.documentElement.style.setProperty("--primary", project.settings.primaryColor);
    document.documentElement.style.setProperty("--accent", project.settings.accentColor);
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [project.settings]);

  const selectedAgents = project.project.agents.filter((agent) => agent.selected);
  const hasResults = results.length > 0;
  const enabled: Record<PageKey, boolean> = {
    project: true,
    objects: selectedAgents.length > 0,
    results: selectedAgents.length > 0 && project.research.points.length > 0 && hasResults,
    report: selectedAgents.length > 0 && project.research.points.length > 0 && hasResults,
    settings: true
  };

  useEffect(() => {
    const nextHighlights: Partial<Record<PageKey, boolean>> = {};
    (["objects", "results", "report"] as PageKey[]).forEach((key) => {
      if (enabled[key] && previousEnabled.current[key] === false && key !== page) {
        nextHighlights[key] = true;
      }
    });
    previousEnabled.current = enabled;
    if (Object.keys(nextHighlights).length) {
      setAvailableHighlights((current) => ({ ...current, ...nextHighlights }));
    }
  }, [enabled, page]);

  const navigate = (next: PageKey) => {
    if (!enabled[next]) {
      showToast("Заповніть попередні дані, щоб перейти далі.");
      return;
    }
    setAvailableHighlights((current) => ({ ...current, [next]: false }));
    setPage(next);
    if (window.matchMedia("(max-width: 1100px)").matches) setSidebarCollapsed(true);
  };

  const updateProject = (next: ProjectFile) => setProject(next);
  const resetProject = () => {
    setProject(createDefaultProject());
    setPage("project");
  };

  return (
    <div className="app" data-sidebar-collapsed={sidebarCollapsed}>
      {!sidebarCollapsed && <button className="sidebar-backdrop" aria-label="Закрити меню" onClick={() => setSidebarCollapsed(true)} />}
      <Sidebar page={page} setPage={navigate} enabled={enabled} availableHighlights={availableHighlights} onHelp={() => showToast(helpText[page])}
        collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} />
      <main>
        {page === "project" && <ProjectPage project={project} updateProject={updateProject} />}
        {page === "objects" && <ObjectsPage project={project} updateProject={updateProject} />}
        {page === "results" && <ResultsPage project={project} updateProject={updateProject} results={results} />}
        {page === "report" && <ReportPage project={project} updateProject={updateProject} results={results} />}
        {page === "settings" && <SettingsPage project={project} updateProject={updateProject} resetProject={resetProject} />}
      </main>
      {toast && <Toast message={toast.message} noticeId={toast.id} onDismiss={dismissToast} />}
    </div>
  );
}
