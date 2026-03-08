import { useState } from "react";
import type { TaskType } from "../../types";

const TASK_HINTS: Record<TaskType, string> = {
  refactor:
    "Describe what needs restructuring: which files or patterns have drifted, what coupling needs breaking, and what the end state should look like.",
  frontend:
    "Describe the UI changes needed: what looks wrong, what interactions should change, and what should stay the same.",
  audit:
    "Describe what you want evaluated: code quality, security, performance, architecture alignment, or whether the implementation matches the intended design.",
  implement:
    "List the specific changes: what to add, move, rename, or wire up. Be concrete -- this type works best with clear, prescriptive instructions.",
};

type ReformulateStep = "write" | "loading" | "review";

interface IntentStageProps {
  roughIntent: string;
  taskType: TaskType;
  onIntentChange: (value: string) => void;
  onContinue: () => void;
  onSkipToModel: () => void;
  reformulateIntent: (roughIntent: string) => Promise<string>;
  disabled?: boolean;
}

export function IntentStage({
  roughIntent,
  taskType,
  onIntentChange,
  onContinue,
  onSkipToModel,
  reformulateIntent,
  disabled,
}: IntentStageProps) {
  const [reformulateStep, setReformulateStep] =
    useState<ReformulateStep>("write");
  const [reformulatedText, setReformulatedText] = useState("");
  const [reformulateError, setReformulateError] = useState<string | null>(null);

  const hint = TASK_HINTS[taskType];
  const hasIntent = roughIntent.trim().length > 0;
  const isBusy = disabled || reformulateStep === "loading";

  async function handleReformulate() {
    setReformulateError(null);
    setReformulateStep("loading");
    try {
      const result = await reformulateIntent(roughIntent.trim());
      setReformulatedText(result);
      setReformulateStep("review");
    } catch (err) {
      setReformulateError(
        err instanceof Error ? err.message : "Reformulation failed.",
      );
      setReformulateStep("write");
    }
  }

  function handleAcceptReformulated() {
    onIntentChange(reformulatedText);
    setReformulateStep("write");
    onContinue();
  }

  function handleBackToWrite() {
    setReformulateStep("write");
    setReformulatedText("");
    setReformulateError(null);
  }

  // ── Review step ──
  if (reformulateStep === "review") {
    return (
      <div className="grid gap-5">
        {/* Panel grid: original + reformulated */}
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          }}
        >
          {/* Original (read-only) */}
          <div className="grid gap-2">
            <span
              className="field-label"
              style={{ color: "var(--text-muted)" }}
            >
              Original
            </span>
            <div
              className="rounded-xl px-4 py-3 text-sm leading-relaxed"
              style={{
                background: "var(--bg-subtle)",
                border: "1px solid var(--border-default)",
                color: "var(--text-muted)",
                minHeight: "8rem",
                whiteSpace: "pre-wrap",
              }}
            >
              {roughIntent}
            </div>
          </div>

          {/* Reformulated (editable) */}
          <div className="grid gap-2">
            <span className="field-label">Reformulated — edit if needed</span>
            <textarea
              value={reformulatedText}
              onChange={(e) => setReformulatedText(e.target.value)}
              className="field-textarea"
              style={{ minHeight: "8rem" }}
              aria-label="Reformulated intent"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleAcceptReformulated}
            disabled={!reformulatedText.trim()}
          >
            Use this and continue to clarification
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleBackToWrite}
          >
            Edit original
          </button>
        </div>
      </div>
    );
  }

  // ── Write step (including loading state) ──
  return (
    <div className="grid gap-5">
      {/* Guidance hint */}
      <div
        className="rounded-xl px-4 py-3 text-sm leading-relaxed"
        style={{
          background: "var(--bg-subtle)",
          border: "1px solid var(--border-default)",
          color: "var(--text-secondary)",
        }}
      >
        {hint}
      </div>

      {/* Textarea */}
      <label className="grid gap-2">
        <span className="field-label">What do you need done?</span>
        <textarea
          value={roughIntent}
          onChange={(e) => onIntentChange(e.target.value)}
          placeholder="Describe the task in plain language..."
          className="field-textarea"
          style={{ minHeight: "8rem" }}
          disabled={isBusy}
        />
      </label>

      {/* Inline error */}
      {reformulateError && (
        <p className="text-sm" style={{ color: "var(--status-error)" }}>
          {reformulateError}
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void handleReformulate()}
          disabled={isBusy || !hasIntent}
        >
          {reformulateStep === "loading"
            ? "Reformulating..."
            : "Reformulate and continue"}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onContinue}
          disabled={isBusy || !hasIntent}
        >
          Skip reformulation
        </button>
        <button
          type="button"
          className="btn btn-muted"
          onClick={onSkipToModel}
          disabled={isBusy || !hasIntent}
        >
          Skip to model selection
        </button>
        {!hasIntent && (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Write your intent to continue
          </p>
        )}
      </div>
    </div>
  );
}
