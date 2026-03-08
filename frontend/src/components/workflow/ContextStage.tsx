import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Project, TaskType } from "../../types";
import { TASK_OPTIONS } from "../../types";

interface ContextStageProps {
  projects: Project[];
  selectedProjectId: string;
  taskType: TaskType;
  onProjectChange: (projectId: string) => void;
  onTaskTypeChange: (taskType: TaskType) => void;
  onContinue: () => void;
  disabled?: boolean;
}

export function ContextStage({
  projects,
  selectedProjectId,
  taskType,
  onProjectChange,
  onTaskTypeChange,
  onContinue,
  disabled,
}: ContextStageProps) {
  const [expandedTask, setExpandedTask] = useState<TaskType | null>(taskType);
  const hasProject = selectedProjectId !== "";

  return (
    <div className="grid gap-6">
      {/* Project selector */}
      <div className="grid gap-3">
        <label className="grid gap-2">
          <span className="field-label">Project</span>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Choose the project so the compiler can use its repo map for context.
          </p>
          <select
            value={selectedProjectId}
            onChange={(e) => onProjectChange(e.target.value)}
            className="field-select"
            disabled={disabled}
          >
            <option value="">Select a project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Task type accordion */}
      <div className="grid gap-3">
        <span className="field-label">Task type</span>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Pick the kind of work so the questions and prompt stay in the right
          mode.
        </p>

        <div className="grid gap-2">
          {TASK_OPTIONS.map((option) => {
            const isSelected = taskType === option.value;
            const isExpanded = expandedTask === option.value;

            return (
              <div
                key={option.value}
                style={{
                  border: `1px solid ${
                    isSelected ? "var(--accent-muted)" : "var(--border-default)"
                  }`,
                  borderRadius: "1.05rem",
                  background: isSelected
                    ? "var(--bg-surface-hover)"
                    : "var(--bg-muted)",
                  overflow: "hidden",
                  transition: "border-color 150ms ease, background 150ms ease",
                }}
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                  disabled={disabled}
                  onClick={() => {
                    onTaskTypeChange(option.value);
                    setExpandedTask(isExpanded ? null : option.value);
                  }}
                >
                  {/* Radio indicator */}
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                    style={{
                      border: `2px solid ${
                        isSelected
                          ? "var(--accent-primary)"
                          : "var(--border-subtle)"
                      }`,
                    }}
                  >
                    {isSelected && (
                      <span
                        className="block h-2.5 w-2.5 rounded-full"
                        style={{ background: "var(--accent-primary)" }}
                      />
                    )}
                  </span>

                  <span
                    className="flex-1 text-sm font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {option.label}
                  </span>

                  <ChevronDown
                    size={14}
                    style={{
                      color: "var(--text-muted)",
                      transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 150ms ease",
                    }}
                    aria-hidden
                  />
                </button>

                {isExpanded && (
                  <div
                    className="px-4 pb-3.5"
                    style={{ paddingLeft: "3.25rem" }}
                  >
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {option.summary}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Primary action */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onContinue}
          disabled={disabled || !hasProject}
        >
          Continue to intent
        </button>
        {!hasProject && (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Select a project to continue
          </p>
        )}
      </div>
    </div>
  );
}
