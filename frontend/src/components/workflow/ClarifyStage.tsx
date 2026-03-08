import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type {
  ClarifyingQuestion,
  ClarifyingAnswer,
  ClarifyRound,
} from "../../types";

interface ClarifyStageProps {
  rounds: ClarifyRound[];
  currentQuestions: ClarifyingQuestion[];
  answersByQuestionId: Record<string, string>;
  onAnswerChange: (questionId: string, answer: string) => void;
  onSubmitAndContinue: () => void;
  onRequestAnotherRound: () => void;
  onSkip: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function ClarifyStage({
  rounds,
  currentQuestions,
  answersByQuestionId,
  onAnswerChange,
  onSubmitAndContinue,
  onRequestAnotherRound,
  onSkip,
  loading,
  disabled,
}: ClarifyStageProps) {
  const answeredCount = currentQuestions.filter((q) =>
    answersByQuestionId[q.id]?.trim(),
  ).length;
  const hasAnswers = answeredCount > 0;

  return (
    <div className="grid gap-5">
      {/* Previous rounds summary */}
      {rounds.length > 0 && (
        <div className="grid gap-2">
          <span className="field-label">Previous rounds</span>
          {rounds.map((round) => (
            <RoundSummary key={round.id} round={round} />
          ))}
        </div>
      )}

      {/* Current questions */}
      {loading ? (
        <div
          className="rounded-xl px-4 py-6 text-center text-sm"
          style={{
            background: "var(--bg-subtle)",
            border: "1px solid var(--border-default)",
            color: "var(--text-muted)",
          }}
        >
          Generating clarifying questions...
        </div>
      ) : currentQuestions.length > 0 ? (
        <div className="grid gap-4">
          <span className="field-label">
            Round {rounds.length + 1} -- {currentQuestions.length} questions
          </span>
          {currentQuestions.map((question) => (
            <QuestionInput
              key={question.id}
              question={question}
              value={answersByQuestionId[question.id] ?? ""}
              onChange={(val) => onAnswerChange(question.id, val)}
              disabled={disabled}
            />
          ))}
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
          No clarifying questions needed for this intent. You can skip ahead or
          request a round.
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onSubmitAndContinue}
          disabled={disabled || loading}
        >
          {hasAnswers
            ? `Submit ${answeredCount} answer${answeredCount === 1 ? "" : "s"} & continue`
            : "Continue to model selection"}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onRequestAnotherRound}
          disabled={disabled || loading}
        >
          Request another round
        </button>
        <button
          type="button"
          className="btn btn-muted"
          onClick={onSkip}
          disabled={disabled || loading}
        >
          Skip clarification
        </button>
      </div>
    </div>
  );
}

// ── Subcomponents ──

function QuestionInput({
  question,
  value,
  onChange,
  disabled,
}: {
  question: ClarifyingQuestion;
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  if (question.input_type === "single_choice" && question.options.length > 0) {
    return (
      <fieldset className="grid gap-2">
        <legend
          className="text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          {question.question}
        </legend>
        <div className="grid gap-1.5 pl-1">
          {question.options.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              <input
                type="radio"
                name={question.id}
                value={opt.value}
                checked={value === opt.value}
                onChange={() => onChange(opt.value)}
                disabled={disabled}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  if (question.input_type === "multi_choice" && question.options.length > 0) {
    const selected = value ? value.split(",") : [];
    return (
      <fieldset className="grid gap-2">
        <legend
          className="text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          {question.question}
        </legend>
        <div className="grid gap-1.5 pl-1">
          {question.options.map((opt) => {
            const isChecked = selected.includes(opt.value);
            return (
              <label
                key={opt.value}
                className="flex items-center gap-2 text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {
                    const next = isChecked
                      ? selected.filter((v) => v !== opt.value)
                      : [...selected, opt.value];
                    onChange(next.join(","));
                  }}
                  disabled={disabled}
                />
                {opt.label}
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }

  // Free text
  return (
    <label className="grid gap-2">
      <span
        className="text-sm font-medium"
        style={{ color: "var(--text-primary)" }}
      >
        {question.question}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={question.placeholder ?? "Your answer..."}
        className="field-input"
        disabled={disabled}
      />
    </label>
  );
}

function RoundSummary({ round }: { round: ClarifyRound }) {
  const [open, setOpen] = useState(false);
  const answeredCount = round.answers.length;

  return (
    <div
      style={{
        border: "1px solid var(--border-default)",
        borderRadius: "0.85rem",
        background: "var(--bg-subtle)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm"
        onClick={() => setOpen((prev) => !prev)}
      >
        <ChevronDown
          size={14}
          style={{
            color: "var(--text-muted)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 150ms ease",
          }}
          aria-hidden
        />
        <span style={{ color: "var(--text-secondary)" }}>
          Round {round.round_number}: {answeredCount} question
          {answeredCount === 1 ? "" : "s"} answered
        </span>
      </button>
      {open && (
        <div
          className="grid gap-2 px-3.5 pb-3"
          style={{
            borderTop: "1px solid var(--border-default)",
            paddingTop: "0.75rem",
          }}
        >
          {round.answers.map((a) => (
            <div key={a.question_id} className="grid gap-0.5 text-sm">
              <span style={{ color: "var(--text-muted)" }}>
                {a.question ?? "Question"}
              </span>
              <span style={{ color: "var(--text-primary)" }}>{a.answer}</span>
            </div>
          ))}
          {round.answers.length === 0 && (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No answers recorded for this round.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
