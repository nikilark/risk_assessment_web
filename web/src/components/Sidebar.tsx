import { BarChart3, FileText, HelpCircle, MapPinned, Settings, TestTube2, type LucideIcon } from "lucide-react";
import type { PageKey } from "../App";

const items: Array<{ key: PageKey; label: string; icon: LucideIcon }> = [
  { key: "project", label: "Проєкт", icon: TestTube2 },
  { key: "objects", label: "Об'єкти", icon: MapPinned },
  { key: "results", label: "Результати", icon: BarChart3 },
  { key: "report", label: "Звіт", icon: FileText }
];

const appIconUrl = `${import.meta.env.BASE_URL}icons/app-icon.jpg`;

export function Sidebar({
  page,
  setPage,
  enabled,
  availableHighlights,
  onHelp,
  collapsed,
  onToggle
}: {
  page: PageKey;
  setPage: (page: PageKey) => void;
  enabled: Record<PageKey, boolean>;
  availableHighlights: Partial<Record<PageKey, boolean>>;
  onHelp: () => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside className="sidebar">
      <button type="button" className="brand" aria-label={collapsed ? "Розгорнути меню" : "Згорнути меню"}
        title={collapsed ? "Розгорнути меню" : "Згорнути меню"} aria-expanded={!collapsed} aria-controls="page-navigation" onClick={onToggle}>
        <div className="brand-mark">
          <img src={appIconUrl} alt="" aria-hidden="true" />
        </div>
        <div>
          <strong>Risk Assessment</strong>
          <span>Air Pollution Assistant</span>
        </div>
      </button>
      <nav id="page-navigation" aria-label="Основна навігація">
        {items.map((item) => {
          const Icon = item.icon;
          const active = page === item.key;
          const disabled = !enabled[item.key];
          const available = Boolean(availableHighlights[item.key]);
          return (
            <button className={`nav-item ${active ? "active" : ""} ${available ? "newly-available" : ""}`} aria-label={item.label} title={item.label} disabled={disabled} key={item.key} onClick={() => setPage(item.key)}>
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="sidebar-bottom">
        <button className={`nav-item sidebar-action ${page === "settings" ? "active" : ""}`} onClick={() => setPage("settings")} title="Налаштування">
          <Settings size={22} />
          <span>Налаштування</span>
        </button>
        <button className="nav-item sidebar-action" onClick={onHelp} title="Довідка">
          <HelpCircle size={22} />
          <span>Довідка</span>
        </button>
      </div>
    </aside>
  );
}
