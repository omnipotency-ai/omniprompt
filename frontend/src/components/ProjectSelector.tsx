import type { Project } from "../types";

interface ProjectSelectorProps {
  projects: Project[];
  value: string;
  onChange: (projectId: string) => void;
  onRefreshMap?: (projectId: string) => void;
  disabled?: boolean;
  loadingProjectId?: string | null;
}

export function ProjectSelector({
  projects,
  value,
  onChange,
  onRefreshMap,
  disabled = false,
  loadingProjectId = null,
}: ProjectSelectorProps) {
  const selectedProject = projects.find((project) => project.id === value) ?? null;

  return (
    <section className="grid gap-4">
      <div className="grid gap-2">
        <p className="field-label">Project</p>
        <p className="section-copy content-clamp">
          Pick the codebase you want to inspect so the backend can ground its prompt
          context in a real repo map instead of a raw guess.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled || projects.length === 0}
          className="field-select"
          aria-label="Select a project"
        >
          <option value="">
            {projects.length === 0 ? "No projects yet" : "Choose a project"}
          </option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>

        {onRefreshMap ? (
          <button
            type="button"
            className="btn btn-dark"
            disabled={disabled || !value}
            onClick={() => onRefreshMap(value)}
          >
            {loadingProjectId === value ? "Refreshing..." : "Refresh map"}
          </button>
        ) : null}
      </div>

      {selectedProject ? (
        <div className="panel-subtle grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`badge ${selectedProject.repo_map_path ? "badge-success" : "badge-accent"}`}>
              {selectedProject.repo_map_path ? "Repo map ready" : "Map missing"}
            </span>
            <span className="text-sm font-medium text-ink-900">{selectedProject.name}</span>
          </div>

          <div className="grid gap-2 text-sm leading-6 text-ink-700">
            <p className="break-all text-ink-900">{selectedProject.path}</p>
            <p>
              Last mapped:{" "}
              {selectedProject.last_mapped_at
                ? new Date(selectedProject.last_mapped_at).toLocaleString()
                : "Not yet"}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default ProjectSelector;
