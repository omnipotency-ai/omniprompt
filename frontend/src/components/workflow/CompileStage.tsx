import { useState } from "react";
import { Copy, Check, ChevronDown } from "lucide-react";
import type { CompiledVersion, ModelChoice } from "../../types";
import { getModelLabel } from "../../types";

interface CompileStageProps {
  compiledPrompt: string;
  targetModel: ModelChoice;
  versions: CompiledVersion[];
  onCopy: () => void;
  onReviseIntent: () => void;
  onChangeModel: () => void;
  onRegenerate: () => void;
  onIterateFrom: (versionLabel: string) => void;
  onContinue: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function CompileStage({
  compiledPrompt,
  targetModel,
  versions,
  onCopy,
  onReviseIntent,
  onChangeModel,
  onRegenerate,
  onIterateFrom,
  onContinue,
  loading,
  disabled,
}: CompileStageProps) {
  const [copied, setCopied] = useState(false);
  const [showVersions, setShowVersions] = useState(false);

  function handleCopy() {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

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
          Compiling prompt...
        </div>
      ) : compiledPrompt ? (
        <div className="grid gap-3">
          {/* Compiled output */}
          <div className="flex items-center justify-between gap-3">
            <span className="field-label">
              Compiled for {getModelLabel(targetModel)}
            </span>
            <button
              type="button"
              className="btn btn-secondary flex items-center gap-1.5"
              style={{
                minHeight: "2.2rem",
                padding: "0.4rem 0.75rem",
                fontSize: "0.82rem",
              }}
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check size={14} /> Copied
                </>
              ) : (
                <>
                  <Copy size={14} /> Copy prompt
                </>
              )}
            </button>
          </div>

          <pre className="code-block">{compiledPrompt}</pre>
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
          The compiled prompt will appear here.
        </div>
      )}

      {/* Version history */}
      {versions.length > 1 && (
        <div>
          <button
            type="button"
            className="flex items-center gap-1.5 text-sm"
            style={{ color: "var(--accent-text)" }}
            onClick={() => setShowVersions((prev) => !prev)}
          >
            <ChevronDown
              size={14}
              style={{
                transform: showVersions ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 150ms ease",
              }}
              aria-hidden
            />
            {versions.length} compiled versions
          </button>
          {showVersions && (
            <div className="mt-2 grid gap-2">
              {versions.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"
                  style={{
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--border-default)",
                  }}
                >
                  <span>
                    <span style={{ color: "var(--text-primary)" }}>
                      {v.version_label}
                    </span>
                    <span style={{ color: "var(--text-muted)" }}>
                      {" "}
                      — {getModelLabel(v.target_model)}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="btn btn-muted"
                    style={{ fontSize: "0.78rem", padding: "0.2rem 0.6rem" }}
                    onClick={() => onIterateFrom(v.version_label)}
                    disabled={disabled || loading}
                  >
                    Iterate from this
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Iteration controls */}
      {compiledPrompt && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onContinue}
            disabled={disabled}
          >
            Continue to save
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onRegenerate}
            disabled={disabled || loading}
          >
            Regenerate
          </button>
          <button
            type="button"
            className="btn btn-muted"
            onClick={onReviseIntent}
            disabled={disabled}
          >
            Revise intent
          </button>
          <button
            type="button"
            className="btn btn-muted"
            onClick={onChangeModel}
            disabled={disabled}
          >
            Change model
          </button>
        </div>
      )}
    </div>
  );
}
