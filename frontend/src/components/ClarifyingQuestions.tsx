import type { ClarifyingQuestion } from "../types";

interface ClarifyingQuestionsProps {
  questions: ClarifyingQuestion[];
  answersByQuestionId: Record<string, string>;
  onAnswerChange: (question: ClarifyingQuestion, value: string) => void;
  onRecommendModel?: () => void;
  onCompilePrompt?: () => void;
  disabled?: boolean;
  busyAction?: "route" | "compile" | null;
}

function parseMultiValue(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function toggleMultiValue(currentValue: string, nextValue: string): string {
  const values = new Set(parseMultiValue(currentValue));
  if (values.has(nextValue)) {
    values.delete(nextValue);
  } else {
    values.add(nextValue);
  }
  return Array.from(values).join(", ");
}

export function ClarifyingQuestions({
  questions,
  answersByQuestionId,
  onAnswerChange,
  onRecommendModel,
  onCompilePrompt,
  disabled = false,
  busyAction = null,
}: ClarifyingQuestionsProps) {
  if (questions.length === 0) {
    return null;
  }

  const answeredCount = questions.filter((question) => {
    const value = answersByQuestionId[question.id];
    return typeof value === "string" && value.trim().length > 0;
  }).length;

  return (
    <section className="panel grid gap-5 p-6">
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-2">
            <p className="field-label">3. Clarify</p>
            <h3 className="section-title text-[1.35rem]">Tighten the unknowns</h3>
          </div>
          <span className="badge badge-accent">
            {answeredCount}/{questions.length} answered
          </span>
        </div>
        <p className="section-copy content-clamp">
          These answers shape the final prompt. Leave one blank only when the work
          can safely proceed without it.
        </p>
      </div>

      <div className="grid gap-4">
        {questions.map((question) => {
          const currentValue = answersByQuestionId[question.id] ?? "";
          const selectedMulti = parseMultiValue(currentValue);

          return (
            <fieldset
              key={question.id}
              className="panel-subtle grid gap-3 disabled:opacity-60"
              disabled={disabled}
            >
              <legend className="px-1 text-base font-semibold text-ink-900">
                {question.question}
              </legend>

              {question.input_type === "free_text" ? (
                <textarea
                  value={currentValue}
                  onChange={(event) => onAnswerChange(question, event.target.value)}
                  placeholder={question.placeholder ?? "Add a concrete answer"}
                  className="field-textarea min-h-32 bg-white"
                />
              ) : (
                <div className="grid gap-2.5">
                  {question.options.map((option) => {
                    const checked =
                      question.input_type === "multi_choice"
                        ? selectedMulti.includes(option.value)
                        : currentValue === option.value;

                    return (
                      <label
                        key={option.value}
                        className="grid cursor-pointer grid-cols-[auto_1fr] items-center gap-3 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-ink-900 transition hover:border-clay-500/30"
                      >
                        <input
                          type={
                            question.input_type === "multi_choice"
                              ? "checkbox"
                              : "radio"
                          }
                          name={question.id}
                          checked={checked}
                          onChange={() =>
                            onAnswerChange(
                              question,
                              question.input_type === "multi_choice"
                                ? toggleMultiValue(currentValue, option.value)
                                : option.value,
                            )
                          }
                          className="h-4 w-4 accent-clay-500"
                        />
                        <span>{option.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </fieldset>
          );
        })}
      </div>

      <div className="panel-subtle grid gap-3">
        <p className="section-copy">
          Session state stays synced while you answer. Continue when the open
          questions are narrowed enough to route or compile.
        </p>

        <div className="flex flex-wrap gap-3">
          {onRecommendModel ? (
            <button
              type="button"
              className="btn btn-dark"
              onClick={onRecommendModel}
              disabled={disabled}
            >
              {busyAction === "route"
                ? "Generating recommendation..."
                : "Recommend model"}
            </button>
          ) : null}

          {onCompilePrompt ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onCompilePrompt}
              disabled={disabled}
            >
              {busyAction === "compile" ? "Compiling..." : "Compile prompt"}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default ClarifyingQuestions;
