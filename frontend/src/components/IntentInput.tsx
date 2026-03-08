import type { TaskType } from "../types";

interface IntentInputProps {
  taskType: TaskType;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const TASK_HINTS: Record<TaskType, string> = {
  refactor:
    "Describe the mess plainly: where structure has drifted, what feels coupled, and what outcome you want from the cleanup.",
  frontend_iteration:
    "Describe what feels wrong in the existing frontend: visual design, hierarchy, onboarding clarity, layout, interaction flow, or connected component behavior. Say what should stay stable and what should improve.",
  audit:
    "Describe what you want inspected: unnecessary files, duplicated helpers, architecture sprawl, or whether the code still matches the intended product behavior.",
};

export function IntentInput({
  taskType,
  value,
  onChange,
  disabled = false,
}: IntentInputProps) {
  return (
    <section className="grid gap-4">
      <div className="grid gap-2">
        <p className="field-label">Intent</p>
        <h3 className="section-title text-[1.35rem]">Describe the real job</h3>
        <p className="section-copy content-clamp">{TASK_HINTS[taskType]}</p>
      </div>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="field-textarea min-h-60"
        placeholder={
          taskType === "refactor"
            ? "This app has grown organically. The file structure feels wrong, helpers are duplicated, and several components have become god-components..."
            : taskType === "frontend_iteration"
              ? "This frontend works, but the UI feels wrong. The hierarchy is unclear, the onboarding flow is confusing, and the visual direction does not fit the product. I want the existing app improved without turning it into a rewrite..."
              : "I want to know which parts of this codebase are actually necessary, which pieces overlap, and whether the implementation still matches the original idea..."
        }
        aria-label="Describe the task"
      />
    </section>
  );
}

export default IntentInput;
