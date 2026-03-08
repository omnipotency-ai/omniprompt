import {
  MODEL_OPTIONS,
  getModelLabel,
  type ModelChoice,
  type RouteResponse,
  type TaskType,
} from "../types";

interface ModelSelectorProps {
  taskType: TaskType;
  selectedModel: ModelChoice;
  onChange: (model: ModelChoice) => void;
  recommendation?: RouteResponse | null;
  disabled?: boolean;
  compact?: boolean;
}

export function ModelSelector({
  taskType,
  selectedModel,
  onChange,
  recommendation,
  disabled = false,
  compact = false,
}: ModelSelectorProps) {
  return (
    <section className="panel grid gap-5 p-6">
      <div className="grid gap-2">
        <p className="field-label">4. Target model</p>
        <h3 className="section-title text-[1.35rem]">Choose the audience</h3>
        <p className="section-copy content-clamp">
          The compiler is OpenAI-powered. Pick the model you want the final prompt
          written for, then override the recommendation only when you have a reason.
        </p>
      </div>

      {recommendation ? (
        <div className="panel-subtle grid gap-2 border border-emerald-900/10 bg-emerald-50/90">
          <span className="badge badge-success">Recommended</span>
          <strong className="text-ink-900">
            {getModelLabel(recommendation.recommended_model)}
          </strong>
          <span className="text-sm leading-6 text-ink-700">
            {recommendation.reasoning} Complexity:{" "}
            {recommendation.estimated_complexity}.
          </span>
        </div>
      ) : null}

      <div className={compact ? "grid gap-3 md:grid-cols-2 2xl:grid-cols-1" : "grid gap-3 md:grid-cols-2 xl:grid-cols-3"}>
        {MODEL_OPTIONS.map((option) => {
          const selected = option.value === selectedModel;

          return (
            <button
              key={option.value}
              type="button"
              className={`grid gap-2 rounded-[1.05rem] border px-4 py-4 text-left transition hover:-translate-y-0.5 ${
                selected
                  ? "border-clay-500/35 bg-white shadow-[0_14px_34px_rgba(16,24,40,0.08)]"
                  : "border-black/10 bg-sand-50/85 hover:border-clay-500/20 hover:bg-white"
              }`}
              onClick={() => onChange(option.value)}
              disabled={disabled}
              aria-pressed={selected}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-ink-900">{option.label}</strong>
                {recommendation?.recommended_model === option.value ? (
                  <span className="badge badge-accent">Recommended for {taskType}</span>
                ) : null}
              </div>
              <span className="text-sm leading-6 text-ink-700">{option.summary}</span>
              <span className="text-sm leading-6 text-ink-700">{option.bestFor}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default ModelSelector;
