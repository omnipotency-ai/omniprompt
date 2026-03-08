import { useMemo, useState } from "react";

import { LibraryPage } from "./pages/Library";
import { ProjectsPage } from "./pages/Projects";
import { WorkbenchPage } from "./pages/Workbench";

type PageId = "workbench" | "library" | "projects";

const NAV_ITEMS: Array<{
  id: PageId;
  label: string;
  kicker: string;
  description: string;
}> = [
  {
    id: "workbench",
    label: "Workbench",
    kicker: "Prompt workflow",
    description:
      "Shape intent, clarify what matters, choose the audience model, and keep session state visible while you iterate.",
  },
  {
    id: "library",
    label: "Library",
    kicker: "Saved prompts",
    description:
      "Review successful prompts, the notes behind them, and the model-task combinations worth reusing.",
  },
  {
    id: "projects",
    label: "Projects",
    kicker: "Repo context",
    description:
      "Register codebases and refresh repo maps so downstream prompt work stays grounded in the right source tree.",
  },
];

export default function App() {
  const [activePage, setActivePage] = useState<PageId>("workbench");
  const [projectsVersion, setProjectsVersion] = useState(0);

  const activeItem = useMemo(
    () => NAV_ITEMS.find((item) => item.id === activePage) ?? NAV_ITEMS[0],
    [activePage],
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(47,91,209,0.16),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(16,24,40,0.08),transparent_28%),linear-gradient(180deg,#f7f9fc_0%,#eef3f8_100%)]">
      <div className="mx-auto grid min-h-screen w-full max-w-[1600px] gap-5 px-4 py-4 lg:grid-cols-[17rem_minmax(0,1fr)] lg:px-6 lg:py-6">
        <aside className="app-sidebar flex flex-col gap-6 lg:sticky lg:top-6 lg:self-start">
          <div className="grid gap-3">
            <div className="grid gap-2">
              <p className="eyebrow">Prompt compiler</p>
              <h1 className="text-[2.1rem] font-semibold tracking-[-0.05em] text-ink-900">
                Prompt OS
              </h1>
            </div>
            <p className="section-copy">
              Turn rough engineering asks into sharper prompt artifacts with project
              context, saved sessions, and a reusable library.
            </p>
          </div>

          <nav className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1" aria-label="Primary">
            {NAV_ITEMS.map((item) => {
              const active = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`nav-item ${active ? "nav-item-active" : "nav-item-inactive"}`}
                  onClick={() => setActivePage(item.id)}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="eyebrow">{item.kicker}</span>
                  <span className="text-base font-semibold text-ink-900">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="panel-subtle grid gap-2">
            <p className="eyebrow">Current surface</p>
            <div className="grid gap-1">
              <strong className="text-base font-semibold text-ink-900">
                {activeItem.label}
              </strong>
              <p className="section-copy">{activeItem.description}</p>
            </div>
          </div>
        </aside>

        <div className="min-w-0 py-1">
          <main className="min-w-0">
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
    </div>
  );
}
