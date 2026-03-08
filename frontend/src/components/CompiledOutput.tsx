import {
  getModelLabel,
  getTaskLabel,
  type ModelChoice,
  type TaskType,
} from "../types";

interface CompiledOutputProps {
  taskType: TaskType;
  targetModel: ModelChoice;
  compiledPrompt: string;
  projectContextUsed: boolean;
  onCopy: () => void;
  copied?: boolean;
}

export function CompiledOutput({
  taskType,
  targetModel,
  compiledPrompt,
  projectContextUsed,
  onCopy,
  copied = false,
}: CompiledOutputProps) {
  if (!compiledPrompt.trim()) {
    return null;
  }

  return (
    <section className="panel grid gap-5 p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            <span className="badge badge-muted">{getTaskLabel(taskType)}</span>
            <span className="badge badge-muted">{getModelLabel(targetModel)}</span>
            {projectContextUsed ? (
              <span className="badge badge-accent">Repo map used</span>
            ) : null}
          </div>

          <div className="grid gap-2">
            <p className="field-label">Final prompt</p>
            <p className="section-copy content-clamp">
              This is the final artifact to paste into the selected target model.
              Copy it directly or save it to the library with a note about why it
              worked.
            </p>
          </div>
        </div>

        <button type="button" className="btn btn-secondary" onClick={onCopy}>
          {copied ? "Copied" : "Copy prompt"}
        </button>
      </div>

      <pre className="code-block">{compiledPrompt}</pre>
    </section>
  );
}

export default CompiledOutput;
