import { Check, Lock, ChevronDown } from "lucide-react";

export type StageStatus = "idle" | "active" | "complete";

interface WorkflowStageProps {
  stageNumber: number;
  title: string;
  summary?: string;
  status: StageStatus;
  children: React.ReactNode;
  onToggle?: () => void;
}

export function WorkflowStage({
  stageNumber,
  title,
  summary,
  status,
  children,
  onToggle,
}: WorkflowStageProps) {
  const isExpanded = status === "active";
  const canToggle = status === "complete" && onToggle;
  const contentId = `workflow-stage-${stageNumber}-content`;

  return (
    <section
      data-slot="workflow-stage"
      style={{
        border: `1px solid ${
          status === "active"
            ? "var(--stage-active-border)"
            : status === "complete"
              ? "var(--stage-complete-border)"
              : "var(--border-default)"
        }`,
        background:
          status === "active"
            ? "var(--bg-elevated)"
            : status === "complete"
              ? "var(--stage-complete)"
              : "var(--bg-inactive)",
        borderRadius: "1.35rem",
        boxShadow:
          status === "active"
            ? "0 18px 48px var(--shadow-lg)"
            : "0 8px 22px var(--shadow-sm)",
        backdropFilter: status === "active" ? "blur(14px)" : undefined,
        transition:
          "border-color 200ms ease, background 200ms ease, box-shadow 200ms ease",
      }}
    >
      {/* Header row */}
      <button
        type="button"
        onClick={canToggle ? onToggle : undefined}
        disabled={!canToggle}
        aria-expanded={isExpanded}
        aria-controls={contentId}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
        style={{
          cursor: canToggle ? "pointer" : "default",
          opacity: status === "idle" ? 0.55 : 1,
        }}
      >
        {/* Stage indicator */}
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
          style={{
            background:
              status === "complete"
                ? "var(--status-success-muted)"
                : status === "active"
                  ? "var(--accent-muted)"
                  : "var(--stage-idle)",
            color:
              status === "complete"
                ? "var(--status-success)"
                : status === "active"
                  ? "var(--accent-text)"
                  : "var(--text-muted)",
          }}
        >
          {status === "complete" ? (
            <Check size={16} />
          ) : status === "idle" ? (
            <Lock size={14} />
          ) : (
            stageNumber
          )}
        </span>

        {/* Title + summary */}
        <div className="min-w-0 flex-1">
          <p
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {title}
          </p>
          {status === "complete" && summary && (
            <p
              className="mt-0.5 truncate text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              {summary}
            </p>
          )}
        </div>

        {/* Expand chevron for completed stages */}
        {canToggle && (
          <ChevronDown
            size={16}
            style={{ color: "var(--text-muted)" }}
            aria-hidden
          />
        )}
      </button>

      {/* Content area */}
      {isExpanded && (
        <div
          id={contentId}
          role="region"
          aria-labelledby={`workflow-stage-${stageNumber}-header`}
          className="px-5 pb-5"
          style={{
            borderTop: "1px solid var(--border-default)",
            paddingTop: "1.25rem",
          }}
        >
          {children}
        </div>
      )}
    </section>
  );
}
