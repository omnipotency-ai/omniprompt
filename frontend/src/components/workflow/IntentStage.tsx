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

interface IntentStageProps {
  roughIntent: string;
  taskType: TaskType;
  onIntentChange: (value: string) => void;
  onContinue: () => void;
  onSkipToModel: () => void;
  disabled?: boolean;
}

export function IntentStage({
  roughIntent,
  taskType,
  onIntentChange,
  onContinue,
  onSkipToModel,
  disabled,
}: IntentStageProps) {
  const hint = TASK_HINTS[taskType];
  const hasIntent = roughIntent.trim().length > 0;

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
          disabled={disabled}
        />
      </label>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onContinue}
          disabled={disabled || !hasIntent}
        >
          Continue to clarification
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onSkipToModel}
          disabled={disabled || !hasIntent}
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
