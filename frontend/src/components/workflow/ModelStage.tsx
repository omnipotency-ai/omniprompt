import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ModelChoice, RouteResponse } from "../../types";
import { MODEL_OPTIONS, getModelLabel } from "../../types";

interface ModelStageProps {
  recommendation: RouteResponse | null;
  selectedModel: ModelChoice;
  onModelChange: (model: ModelChoice) => void;
  onAccept: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function ModelStage({
  recommendation,
  selectedModel,
  onModelChange,
  onAccept,
  loading,
  disabled,
}: ModelStageProps) {
  const [showReasoning, setShowReasoning] = useState(false);
  const isOverride =
    recommendation !== null &&
    selectedModel !== recommendation.recommended_model;

  return (
    <div className="grid gap-5">
      {loading ? (
        <div
          className="rounded-xl px-4 py-6 text-center text-sm"
          style={{
            background: "var(--bg-subtle)",
            border: "1px solid var(--border-default)",
            color: "var(--text-muted)",
          }}
        >
          Getting model recommendation...
        </div>
      ) : recommendation ? (
        <div className="grid gap-3">
          {/* Recommendation card */}
          <div
            className="grid gap-2 rounded-xl px-4 py-3.5"
            style={{
              background: "var(--bg-subtle)",
              border: "1px solid var(--border-default)",
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="field-label">Recommended</span>
              <span className="badge badge-accent">
                {recommendation.estimated_complexity} complexity
              </span>
            </div>
            <p
              className="text-base font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {getModelLabel(recommendation.recommended_model)}
            </p>
            {recommendation.budget_alternative && (
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Budget option:{" "}
                {getModelLabel(recommendation.budget_alternative)}
              </p>
            )}

            {/* Collapsible reasoning */}
            <button
              type="button"
              className="flex items-center gap-1.5 text-sm"
              style={{ color: "var(--accent-text)" }}
              onClick={() => setShowReasoning((prev) => !prev)}
            >
              <ChevronDown
                size={14}
                style={{
                  transform: showReasoning ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 150ms ease",
                }}
                aria-hidden
              />
              Why this model
            </button>
            {showReasoning && (
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                {recommendation.reasoning}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div
          className="rounded-xl px-4 py-6 text-center text-sm"
          style={{
            background: "var(--bg-subtle)",
            border: "1px solid var(--border-default)",
            color: "var(--text-muted)",
          }}
        >
          No recommendation yet. The system will suggest a model based on your
          intent and answers.
        </div>
      )}

      {/* Override dropdown */}
      <label className="grid gap-2">
        <span className="field-label">
          {recommendation ? "Override model" : "Select model"}
        </span>
        <select
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value as ModelChoice)}
          className="field-select"
          disabled={disabled || loading}
        >
          {MODEL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label} -- {opt.summary}
            </option>
          ))}
        </select>
      </label>

      {/* Primary action */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onAccept}
          disabled={disabled || loading}
        >
          {isOverride ? "Use selected model & compile" : "Accept & compile"}
        </button>
        {isOverride && (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Overriding recommendation:{" "}
            {getModelLabel(recommendation!.recommended_model)}
          </p>
        )}
      </div>
    </div>
  );
}
