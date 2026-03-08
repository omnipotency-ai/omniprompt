import type { ModelChoice } from "../../types";
import { getModelLabel } from "../../types";

interface SaveStageProps {
  title: string;
  targetModel: ModelChoice;
  expectedResultAssessment: string;
  effectivenessRating: number;
  onTitleChange: (value: string) => void;
  onAssessmentChange: (value: string) => void;
  onRatingChange: (value: number) => void;
  onSave: () => void;
  loading?: boolean;
  disabled?: boolean;
  successMessage?: string | null;
}

export function SaveStage({
  title,
  targetModel,
  expectedResultAssessment,
  effectivenessRating,
  onTitleChange,
  onAssessmentChange,
  onRatingChange,
  onSave,
  loading,
  disabled,
  successMessage,
}: SaveStageProps) {
  return (
    <div className="grid gap-5">
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Save this prompt to the library for reuse. Rate its effectiveness and
        optionally describe what result you expect it to produce.
      </p>

      {/* Title + model info */}
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <label className="grid gap-2">
          <span className="field-label">Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Auto-derived from your intent"
            className="field-input"
            disabled={disabled || loading}
          />
        </label>

        <div className="grid gap-2">
          <span className="field-label">Target</span>
          <div
            className="field-input flex items-center text-sm"
            style={{
              color: "var(--text-secondary)",
              background: "var(--bg-subtle)",
              cursor: "default",
            }}
          >
            {getModelLabel(targetModel)}
          </div>
        </div>
      </div>

      {/* Rating */}
      <label className="grid gap-2">
        <span className="field-label">Effectiveness rating (1-7)</span>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7].map((val) => (
            <button
              key={val}
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold transition-colors"
              style={{
                background:
                  effectivenessRating === val
                    ? "var(--accent-primary)"
                    : "var(--bg-muted)",
                color:
                  effectivenessRating === val
                    ? "var(--text-on-accent)"
                    : "var(--text-secondary)",
                border: `1px solid ${
                  effectivenessRating === val
                    ? "var(--accent-primary)"
                    : "var(--border-subtle)"
                }`,
              }}
              onClick={() => onRatingChange(val)}
              disabled={disabled || loading}
            >
              {val}
            </button>
          ))}
        </div>
      </label>

      {/* Expected result assessment */}
      <label className="grid gap-2">
        <span className="field-label">
          Expected result assessment (optional)
        </span>
        <textarea
          value={expectedResultAssessment}
          onChange={(e) => onAssessmentChange(e.target.value)}
          placeholder="What result do you expect this prompt to produce? This helps you evaluate the prompt later."
          className="field-textarea"
          style={{ minHeight: "6rem" }}
          disabled={disabled || loading}
        />
      </label>

      {/* Save action */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn btn-dark"
          onClick={onSave}
          disabled={disabled || loading}
        >
          {loading ? "Saving..." : "Save to library"}
        </button>
      </div>

      {successMessage && <p className="status-success">{successMessage}</p>}
    </div>
  );
}
