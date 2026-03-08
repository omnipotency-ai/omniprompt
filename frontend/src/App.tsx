import { useState } from "react";
import { Wrench, BookOpen, FolderGit2, type LucideIcon } from "lucide-react";

import { ThemeSwitcher } from "./components/ThemeSwitcher";
import { LibraryPage } from "./pages/Library";
import { ProjectsPage } from "./pages/Projects";
import { WorkbenchPage } from "./pages/Workbench";

type PageId = "workbench" | "library" | "projects";

interface NavItem {
  id: PageId;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

const NAV: NavItem[] = [
  { id: "workbench", label: "Workbench", icon: Wrench },
  { id: "library", label: "Library", icon: BookOpen },
  { id: "projects", label: "Projects", icon: FolderGit2 },
];

export default function App() {
  const [activePage, setActivePage] = useState<PageId>("workbench");
  const [projectsVersion, setProjectsVersion] = useState(0);

  return (
    <div className="min-h-screen">
      {/* ── Global header ── */}
      <header
        className="flex items-center justify-between px-5 py-3 lg:px-6"
        style={{
          borderBottom: "1px solid var(--border-default)",
          background: "var(--bg-elevated)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="flex items-center gap-3">
          <h1
            className="text-lg font-semibold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Prompt OS
          </h1>
          <span
            className="hidden text-sm sm:inline"
            style={{ color: "var(--text-muted)" }}
          >
            Rough intent to sharp prompts
          </span>
        </div>
        <ThemeSwitcher />
      </header>

      {/* ── Body: sidebar + main ── */}
      <div className="mx-auto grid min-h-[calc(100vh-3.25rem)] w-full max-w-[1600px] gap-0 lg:grid-cols-[13.5rem_minmax(0,1fr)]">
        {/* ── Left sidebar ── */}
        <aside
          className="flex flex-col gap-6 px-3 py-4 lg:sticky lg:top-0 lg:h-[calc(100vh-3.25rem)] lg:overflow-y-auto"
          style={{ borderRight: "1px solid var(--border-default)" }}
        >
          {/* Primary nav */}
          <nav className="grid gap-0.5" aria-label="Primary">
            {NAV.map((item) => {
              const active = activePage === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActivePage(item.id)}
                  aria-current={active ? "page" : undefined}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors duration-150"
                  style={{
                    color: active
                      ? "var(--accent-text)"
                      : "var(--text-secondary)",
                    background: active ? "var(--accent-muted)" : "transparent",
                    borderLeft: active
                      ? "2px solid var(--accent-primary)"
                      : "2px solid transparent",
                  }}
                >
                  <Icon size={16} aria-hidden />
                  <span className="flex-1">{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="badge badge-muted">{item.badge}</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Draft / session placeholder */}
          <div className="grid gap-1.5">
            <p className="eyebrow">Session</p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No active session
            </p>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="min-w-0 px-4 py-4 lg:px-6 lg:py-6">
          {activePage === "workbench" ? (
            <WorkbenchPage
              refreshKey={projectsVersion}
              onOpenProjects={() => setActivePage("projects")}
            />
          ) : activePage === "library" ? (
            <LibraryPage />
          ) : (
            <ProjectsPage
              onProjectsMutated={() => {
                setProjectsVersion((current) => current + 1);
              }}
              onBackToWorkbench={() => setActivePage("workbench")}
            />
          )}
        </main>
      </div>
    </div>
  );
}
