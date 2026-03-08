import { FormEvent, useEffect, useMemo, useState } from "react";

import { createProject, listProjects, refreshProjectMap } from "../api/client";
import type { Project } from "../types";

type ProjectsPageProps = {
  onProjectsMutated: () => void;
  onBackToWorkbench: () => void;
};

export function ProjectsPage({
  onProjectsMutated,
  onBackToWorkbench,
}: ProjectsPageProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [busyProjectId, setBusyProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mappedCount = useMemo(
    () => projects.filter((project) => project.repo_map_path).length,
    [projects],
  );

  async function loadProjects() {
    setLoading(true);
    setErrorMessage(null);

    try {
      const nextProjects = await listProjects();
      setProjects(nextProjects);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load projects.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProjects();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !path.trim()) {
      setErrorMessage("Project name and path are both required.");
      return;
    }

    setBusyProjectId("create");
    setErrorMessage(null);

    try {
      await createProject({ name: name.trim(), path: path.trim() });
      setName("");
      setPath("");
      await loadProjects();
      onProjectsMutated();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create project.");
    } finally {
      setBusyProjectId(null);
    }
  }

  async function handleRefreshMap(projectId: string) {
    setBusyProjectId(projectId);
    setErrorMessage(null);

    try {
      await refreshProjectMap(projectId);
      await loadProjects();
      onProjectsMutated();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to refresh repo map.",
      );
    } finally {
      setBusyProjectId(null);
    }
  }

  return (
    <section className="grid gap-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="grid gap-3">
          <p className="eyebrow">Projects</p>
          <h2 className="page-title">Register repos and keep context fresh</h2>
          <p className="page-description">
            The workbench gets materially better once it can inspect a real repo map
            instead of generating prompts from memory and rough guesses.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[24rem]">
          <div className="panel-subtle">
            <p className="field-label">Connected</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-ink-900">
              {projects.length}
            </p>
            <p className="mt-1 text-sm leading-6 text-ink-700">Projects available to the compiler.</p>
          </div>
          <div className="panel-subtle">
            <p className="field-label">Mapped</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-ink-900">
              {mappedCount}
            </p>
            <p className="mt-1 text-sm leading-6 text-ink-700">Projects with repo-map context ready.</p>
          </div>
        </div>
      </div>

      <section className="panel grid gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <form className="grid gap-5" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <p className="field-label">Register a repo</p>
            <p className="section-copy content-clamp">
              Add the local path once, then refresh the repo map when the source tree
              changes enough to matter for prompt generation.
            </p>
          </div>

          <label className="grid gap-2">
            <span className="field-label">Project name</span>
            <input
              className="field-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Transit Map"
            />
          </label>

          <label className="grid gap-2">
            <span className="field-label">Project path</span>
            <input
              className="field-input"
              value={path}
              onChange={(event) => setPath(event.target.value)}
              placeholder="/Users/you/projects/transit-map"
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <button type="submit" className="btn btn-primary" disabled={busyProjectId === "create"}>
              {busyProjectId === "create" ? "Registering..." : "Register project"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onBackToWorkbench}>
              Back to workbench
            </button>
          </div>

          {errorMessage ? <p className="status-error">{errorMessage}</p> : null}
        </form>

        <div className="panel-subtle grid gap-3">
          <p className="field-label">Why repo maps matter</p>
          <p className="text-sm leading-6 text-ink-700">
            Better repo context improves clarifying questions, model routing, and the
            final prompt structure.
          </p>
          <ul className="grid gap-2 text-sm leading-6 text-ink-700">
            <li>Reduces guesswork about where the relevant code lives.</li>
            <li>Lets prompt output reference the right files and modules.</li>
            <li>Keeps audits and refactors grounded in the real project shape.</li>
          </ul>
        </div>
      </section>

      <section className="panel grid gap-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-1">
            <h3 className="section-title text-[1.3rem]">Connected projects</h3>
            <p className="section-copy">
              Refresh maps whenever structural changes would alter prompt guidance.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void loadProjects()}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Reload"}
          </button>
        </div>

        {projects.length === 0 && !loading ? (
          <p className="text-sm leading-6 text-ink-700">No projects yet.</p>
        ) : (
          <div className="grid gap-4">
            {projects.map((project) => (
              <article
                key={project.id}
                className="grid gap-4 rounded-[1.15rem] border border-black/10 bg-sand-50/82 px-5 py-5 xl:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="grid gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <h4 className="text-lg font-semibold text-ink-900">{project.name}</h4>
                    <span className={`badge ${project.repo_map_path ? "badge-success" : "badge-accent"}`}>
                      {project.repo_map_path ? "Mapped" : "Needs map"}
                    </span>
                  </div>

                  <div className="grid gap-3 text-sm leading-6 text-ink-700 md:grid-cols-2">
                    <div className="grid gap-1">
                      <span className="field-label">Path</span>
                      <p className="break-all text-ink-900">{project.path}</p>
                    </div>
                    <div className="grid gap-1">
                      <span className="field-label">Last mapped</span>
                      <p className="text-ink-900">
                        {project.last_mapped_at
                          ? new Date(project.last_mapped_at).toLocaleString()
                          : "Never"}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary h-fit"
                  onClick={() => void handleRefreshMap(project.id)}
                  disabled={busyProjectId === project.id}
                >
                  {busyProjectId === project.id ? "Mapping..." : "Refresh map"}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
