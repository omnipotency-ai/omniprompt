import { useEffect, useMemo, useRef, useState } from "react";

import {
  clarifyIntent,
  compilePrompt,
  createSession,
  getLatestSession,
  listProjects,
  reformulateIntent as reformulateIntentApi,
  routeModel,
  savePromptToLibrary,
  updateSession,
} from "../api/client";
import { WorkflowStage } from "../components/workflow/WorkflowStage";
import { ContextStage } from "../components/workflow/ContextStage";
import { IntentStage } from "../components/workflow/IntentStage";
import { ClarifyStage } from "../components/workflow/ClarifyStage";
import { ModelStage } from "../components/workflow/ModelStage";
import { CompileStage } from "../components/workflow/CompileStage";
import { SaveStage } from "../components/workflow/SaveStage";
import type {
  ClarifyRound,
  ClarifyingAnswer,
  ClarifyResponse,
  CompiledVersion,
  ModelChoice,
  Project,
  Session,
  RouteResponse,
  SessionUpdateRequest,
  TaskType,
} from "../types";
import { getDefaultModelForTask, getModelLabel, getTaskLabel } from "../types";

import type { StageStatus } from "../components/workflow/WorkflowStage";

// ── Stage definitions ──

type WorkflowStageId =
  | "context"
  | "intent"
  | "clarify"
  | "model"
  | "compile"
  | "save";

const STAGE_ORDER: WorkflowStageId[] = [
  "context",
  "intent",
  "clarify",
  "model",
  "compile",
  "save",
];

const STAGE_TITLES: Record<WorkflowStageId, string> = {
  context: "Project & task type",
  intent: "Describe your intent",
  clarify: "Clarify the unknowns",
  model: "Choose a model",
  compile: "Compile the prompt",
  save: "Save to library",
};

// ── Props ──

type WorkbenchPageProps = {
  refreshKey: number;
  onOpenProjects: () => void;
  onSessionActive?: (title: string | null) => void;
};

// ── Helpers ──

function deriveSessionTitle(roughIntent: string, taskType: TaskType) {
  const compact = roughIntent.trim().replace(/\s+/g, " ");
  if (compact) return compact.slice(0, 160);
  const humanizedTask = taskType
    .replaceAll("_", " ")
    .replace(/\b\w/g, (v) => v.toUpperCase());
  return `${humanizedTask} session`;
}

function deriveLibraryTitle(roughIntent: string, taskType: TaskType): string {
  const intent = roughIntent.trim().replace(/\s+/g, " ");
  if (intent) {
    const firstSentence = intent.split(/[.!?]/)[0].trim();
    return firstSentence.slice(0, 80);
  }
  return getTaskLabel(taskType);
}

// TODO(Phase 4): This is a placeholder versioning scheme that WILL be replaced.
// The correct model is documented in docs/phase4-design.md — a tree/branch scheme
// where session_number is the major (e.g. 7) and the version path encodes branch
// depth (7.01 → 7.02 → 7.021 → 7.0211). Data written with this scheme will need
// migration when Phase 4 ships.
function deriveVersionLabel(
  compiledVersions: CompiledVersion[],
  baseVersionLabel: string | null,
): string {
  if (!baseVersionLabel || compiledVersions.length === 0) {
    // Fresh compile — integer bump
    const majorCount = compiledVersions.filter((v) =>
      /^\d+\.0$/.test(v.version_label),
    ).length;
    return `${majorCount + 1}.0`;
  }
  // Iteration — decimal bump off the base
  const baseMajor = baseVersionLabel.split(".")[0];
  const decimalVersions = compiledVersions.filter(
    (v) =>
      v.version_label.startsWith(`${baseMajor}.`) &&
      v.version_label !== `${baseMajor}.0`,
  );
  const nextDecimal = decimalVersions.length + 1;
  return `${baseMajor}.${String(nextDecimal).padStart(2, "0")}`;
}

function collectAnswers(
  questions: ClarifyResponse["questions"],
  answerMap: Record<string, string>,
): ClarifyingAnswer[] {
  return questions.flatMap((q) => {
    const answer = answerMap[q.id]?.trim();
    if (!answer) return [];
    return [{ question_id: q.id, question: q.question, answer }];
  });
}

// ── Component ──

export function WorkbenchPage({
  refreshKey,
  onOpenProjects,
  onSessionActive,
}: WorkbenchPageProps) {
  // ── Projects ──
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Workflow data ──
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("refactor");
  const [roughIntent, setRoughIntent] = useState("");
  const [clarifyRounds, setClarifyRounds] = useState<ClarifyRound[]>([]);
  const [currentClarifyResult, setCurrentClarifyResult] =
    useState<ClarifyResponse | null>(null);
  const [answersByQuestionId, setAnswersByQuestionId] = useState<
    Record<string, string>
  >({});
  const [routeResult, setRouteResult] = useState<RouteResponse | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelChoice>(
    getDefaultModelForTask("refactor"),
  );
  const [compiledVersions, setCompiledVersions] = useState<CompiledVersion[]>(
    [],
  );
  const [latestCompiledPrompt, setLatestCompiledPrompt] = useState("");

  // ── Save fields ──
  const [libraryTitle, setLibraryTitle] = useState("");
  const [expectedResultAssessment, setExpectedResultAssessment] = useState("");
  const [effectivenessRating, setEffectivenessRating] = useState(5);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // ── Session ──
  const [sessionId, setSessionId] = useState<string | null>(null);
  const autosaveInflight = useRef<boolean>(false);

  // ── Draft restore ──
  const [sessionToRestore, setSessionToRestore] = useState<Session | null>(
    null,
  );
  const [showRestoreBanner, setShowRestoreBanner] = useState(false);

  // ── Stage + busy ──
  const [currentStage, setCurrentStage] = useState<WorkflowStageId>("context");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Derived ──
  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const allAnswers = useMemo(
    () =>
      currentClarifyResult
        ? collectAnswers(currentClarifyResult.questions, answersByQuestionId)
        : [],
    [currentClarifyResult, answersByQuestionId],
  );

  // ── Load projects ──
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingProjects(true);
      setLoadError(null);
      try {
        const nextProjects = await listProjects();
        if (cancelled) return;
        setProjects(nextProjects);
        setSelectedProjectId((cur) =>
          cur && nextProjects.some((p) => p.id === cur)
            ? cur
            : (nextProjects[0]?.id ?? ""),
        );
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Failed to load projects.",
          );
        }
      } finally {
        if (!cancelled) setLoadingProjects(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // ── Check for restorable session on mount ──
  useEffect(() => {
    let cancelled = false;
    async function checkForSession() {
      try {
        const session = await getLatestSession();
        if (cancelled) return;
        if (session && session.rough_intent) {
          setSessionToRestore(session);
          setShowRestoreBanner(true);
        }
      } catch {
        // Non-blocking: if we can't check, just start fresh
      }
    }
    void checkForSession();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // ── Stage status logic ──
  function getStageStatus(stage: WorkflowStageId): StageStatus {
    const stageIndex = STAGE_ORDER.indexOf(stage);
    const currentIndex = STAGE_ORDER.indexOf(currentStage);
    if (stageIndex < currentIndex) return "complete";
    if (stageIndex === currentIndex) return "active";
    return "idle";
  }

  function getStageSummary(stage: WorkflowStageId): string | undefined {
    switch (stage) {
      case "context":
        return `${selectedProject?.name ?? "No project"} · ${getTaskLabel(taskType)}`;
      case "intent":
        return roughIntent.trim().slice(0, 120) || "No intent written";
      case "clarify": {
        const totalAnswers = clarifyRounds.reduce(
          (sum, r) => sum + r.answers.length,
          0,
        );
        const roundCount = clarifyRounds.length;
        if (roundCount === 0 && allAnswers.length === 0) return "Skipped";
        return `${totalAnswers + allAnswers.length} answers across ${roundCount + (currentClarifyResult ? 1 : 0)} rounds`;
      }
      case "model":
        return routeResult
          ? `${getModelLabel(selectedModel)}${selectedModel !== routeResult.recommended_model ? " (manual override)" : " (recommended)"}`
          : getModelLabel(selectedModel);
      case "compile": {
        const latest = compiledVersions[compiledVersions.length - 1];
        return latest
          ? `${latest.version_label} compiled for ${getModelLabel(latest.target_model)}`
          : "Compiled";
      }
      case "save":
        return undefined;
    }
  }

  // ── Navigate stages ──

  function resetDownstreamState(stage: WorkflowStageId) {
    const targetIndex = STAGE_ORDER.indexOf(stage);
    const stagesToClear = STAGE_ORDER.slice(targetIndex + 1);

    for (const s of stagesToClear) {
      switch (s) {
        case "intent":
          setRoughIntent("");
          break;
        case "clarify":
          setClarifyRounds([]);
          setCurrentClarifyResult(null);
          setAnswersByQuestionId({});
          break;
        case "model":
          setRouteResult(null);
          setSelectedModel(getDefaultModelForTask(taskType));
          break;
        case "compile":
          setCompiledVersions([]);
          setLatestCompiledPrompt("");
          break;
        case "save":
          setLibraryTitle("");
          setExpectedResultAssessment("");
          setEffectivenessRating(5);
          setSaveMessage(null);
          break;
      }
    }
  }

  function goToStage(stage: WorkflowStageId) {
    const targetIndex = STAGE_ORDER.indexOf(stage);
    const currentIndex = STAGE_ORDER.indexOf(currentStage);

    // If navigating backwards, clear downstream state
    if (targetIndex < currentIndex) {
      resetDownstreamState(stage);
    }

    setCurrentStage(stage);
    setErrorMessage(null);
    setSaveMessage(null);
  }

  // ── Autosave session at stage transitions ──
  async function autosaveSession(overrides?: Partial<SessionUpdateRequest>) {
    if (autosaveInflight.current) return;
    autosaveInflight.current = true;
    try {
      const sessionTitle = deriveSessionTitle(roughIntent, taskType);
      const base = {
        project_id: selectedProjectId || undefined,
        task_type: taskType,
        title: sessionTitle,
        rough_intent: roughIntent.trim() || undefined,
        status: "open" as const,
      };

      if (sessionId) {
        const payload: SessionUpdateRequest = {
          ...base,
          selected_model: selectedModel,
          ...overrides,
        };
        await updateSession(sessionId, payload);
      } else {
        const session = await createSession(base);
        setSessionId(session.id);
      }
      onSessionActive?.(sessionTitle);
    } catch (err) {
      console.warn("Autosave failed:", err);
    } finally {
      autosaveInflight.current = false;
    }
  }

  // ── Stage helpers ──

  function archiveCurrentRound() {
    if (currentClarifyResult && currentClarifyResult.questions.length > 0) {
      const round: ClarifyRound = {
        id: crypto.randomUUID(),
        round_number: clarifyRounds.length + 1,
        questions: currentClarifyResult.questions,
        answers: allAnswers,
        created_at: new Date().toISOString(),
      };
      setClarifyRounds((prev) => [...prev, round]);
      void autosaveSession({ append_clarify_round: round });
    }
    setCurrentClarifyResult(null);
    setAnswersByQuestionId({});
  }

  // ── Stage handlers ──

  function handleContextContinue() {
    goToStage("intent");
    void autosaveSession();
  }

  async function handleReformulateIntent(intentText: string): Promise<string> {
    const result = await reformulateIntentApi({
      task_type: taskType,
      rough_intent: intentText,
      ...(selectedProjectId && { project_id: selectedProjectId }),
    });
    void autosaveSession({ reformulated_intent: result.reformulated_intent });
    return result.reformulated_intent;
  }

  function handleIntentContinue(skipAutosave?: boolean) {
    // Go to clarify: kick off clarification API call
    if (!skipAutosave) void autosaveSession();
    goToStage("clarify");
    void handleClarifyRequest();
  }

  function handleIntentSkipToModel() {
    void autosaveSession();
    goToStage("model");
    setBusyAction("route");
    void handleRouteRequest();
  }

  async function handleClarifyRequest() {
    setBusyAction("clarify");
    setErrorMessage(null);
    try {
      const response = await clarifyIntent({
        project_id: selectedProjectId || undefined,
        task_type: taskType,
        rough_intent: roughIntent.trim(),
      });
      setCurrentClarifyResult(response);
      setAnswersByQuestionId({});
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to generate questions.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  function handleClarifySubmitAndContinue() {
    archiveCurrentRound();
    goToStage("model");
    setBusyAction("route");
    void handleRouteRequest();
  }

  function handleClarifySkip() {
    void autosaveSession();
    setCurrentClarifyResult(null);
    setAnswersByQuestionId({});
    goToStage("model");
    setBusyAction("route");
    void handleRouteRequest();
  }

  function handleClarifyAnotherRound() {
    archiveCurrentRound();
    void handleClarifyRequest();
  }

  async function handleRouteRequest() {
    setBusyAction("route");
    setErrorMessage(null);
    try {
      // Collect all answers from all rounds + current
      const allRoundAnswers = clarifyRounds.flatMap((r) => r.answers);
      const combined = [...allRoundAnswers, ...allAnswers];

      const response = await routeModel({
        project_id: selectedProjectId || undefined,
        task_type: taskType,
        rough_intent: roughIntent.trim(),
        answers: combined,
      });
      setRouteResult(response);
      setSelectedModel(response.recommended_model);
      void autosaveSession({
        route_result: response,
        selected_model: response.recommended_model,
      });
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to recommend a model.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleModelAccept() {
    goToStage("compile");
    void autosaveSession({ selected_model: selectedModel });
    await handleCompileRequest();
  }

  async function handleCompileRequest(baseLabel?: string) {
    setBusyAction("compile");
    setErrorMessage(null);
    try {
      const allRoundAnswers = clarifyRounds.flatMap((r) => r.answers);
      const combined = [...allRoundAnswers, ...allAnswers];

      const response = await compilePrompt({
        project_id: selectedProjectId || undefined,
        task_type: taskType,
        rough_intent: roughIntent.trim(),
        answers: combined,
        target_model: selectedModel,
      });

      setLatestCompiledPrompt(response.compiled_prompt);

      // Derive the label against the current snapshot of compiledVersions.
      // This is safe because handleCompileRequest is never called concurrently.
      const versionLabel = deriveVersionLabel(
        compiledVersions,
        baseLabel ?? null,
      );
      const version: CompiledVersion = {
        id: crypto.randomUUID(),
        version_label: versionLabel,
        compiled_prompt: response.compiled_prompt,
        target_model: response.target_model,
        project_context_used: response.project_context_used,
        created_at: new Date().toISOString(),
      };
      setCompiledVersions((prev) => [...prev, version]);

      void autosaveSession({ append_compiled_version: version });
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to compile the prompt.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  function handleCompileContinue() {
    void autosaveSession();
    // Auto-populate library title from intent when first entering the save
    // stage, but never overwrite text the user has already typed.
    setLibraryTitle((prev) =>
      prev.trim() ? prev : deriveLibraryTitle(roughIntent, taskType),
    );
    goToStage("save");
  }

  function handleCopyPrompt() {
    if (latestCompiledPrompt) {
      void navigator.clipboard.writeText(latestCompiledPrompt);
    }
  }

  async function handleSaveToLibrary() {
    if (!latestCompiledPrompt) return;
    if (!selectedProjectId) {
      setErrorMessage("Select a project before saving to the library.");
      return;
    }

    setBusyAction("save");
    setErrorMessage(null);
    setSaveMessage(null);
    try {
      const latestVersion = compiledVersions[compiledVersions.length - 1];
      await savePromptToLibrary({
        project_id: selectedProjectId,
        task_type: taskType,
        session_id: sessionId ?? undefined,
        compiled_version_id: latestVersion?.id,
        title: libraryTitle.trim() || undefined,
        rough_intent: roughIntent.trim(),
        compiled_prompt: latestCompiledPrompt,
        target_model: selectedModel,
        ...(expectedResultAssessment.trim() && {
          expected_result_assessment: expectedResultAssessment.trim(),
        }),
        effectiveness_rating: effectivenessRating,
      });
      setSaveMessage("Saved to library.");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to save the prompt.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  // ── Draft restore ──

  function handleRestoreSession() {
    if (!sessionToRestore) return;

    const session = sessionToRestore;
    const restoredTaskType: TaskType = session.task_type ?? "refactor";

    setSessionId(session.id);
    setSelectedProjectId(session.project_id ?? "");
    setTaskType(restoredTaskType);
    setRoughIntent(session.rough_intent ?? "");
    // Coerce potentially-absent arrays once to avoid unsafe raw access below
    const restoredRounds = session.clarify_rounds ?? [];
    const restoredVersions = session.compiled_versions ?? [];

    setClarifyRounds(restoredRounds);
    setSelectedModel(
      session.selected_model ?? getDefaultModelForTask(restoredTaskType),
    );
    setCompiledVersions(restoredVersions);

    const lastVersion = restoredVersions[restoredVersions.length - 1];
    setLatestCompiledPrompt(lastVersion?.compiled_prompt ?? "");

    if (restoredVersions.length > 0) {
      setCurrentStage("compile");
    } else if (session.selected_model) {
      setCurrentStage("model");
    } else if (restoredRounds.length > 0) {
      setCurrentStage("clarify");
    } else if (session.rough_intent) {
      setCurrentStage("intent");
    }

    onSessionActive?.(
      session.title ??
        deriveSessionTitle(session.rough_intent ?? "", restoredTaskType),
    );
    setShowRestoreBanner(false);
    setSessionToRestore(null);
  }

  function handleDismissRestoreBanner() {
    setShowRestoreBanner(false);
    setSessionToRestore(null);
  }

  // ── No projects state ──
  if (!loadingProjects && projects.length === 0) {
    return (
      <section
        className="grid gap-6 mx-auto w-full"
        style={{ maxWidth: "1200px" }}
      >
        <PageHeader />
        <section className="panel grid gap-4 p-6">
          <h3 className="section-title" style={{ fontSize: "1.45rem" }}>
            No projects registered yet
          </h3>
          <p className="section-copy content-clamp">
            Add a project first so the workbench can use a repo map instead of
            guessing across the codebase.
          </p>
          <button
            type="button"
            className="btn btn-primary w-fit"
            onClick={onOpenProjects}
          >
            Open project setup
          </button>
        </section>
      </section>
    );
  }

  // ── Main render ──
  return (
    <section
      className="grid gap-6 mx-auto w-full"
      style={{ maxWidth: "1200px" }}
    >
      <PageHeader />

      {loadError && <p className="status-error">{loadError}</p>}

      {showRestoreBanner && sessionToRestore && (
        <div
          className="flex items-start justify-between gap-4 rounded-lg border px-4 py-3"
          style={{
            background: "var(--bg-elevated)",
            borderColor: "var(--border-default)",
          }}
        >
          <div className="grid gap-1">
            <p
              className="text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              Resume where you left off?
            </p>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {sessionToRestore.title ??
                deriveSessionTitle(
                  sessionToRestore.rough_intent ?? "",
                  sessionToRestore.task_type ?? "refactor",
                )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleRestoreSession}
            >
              Resume
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDismissRestoreBanner}
            >
              Start fresh
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {/* Context stage */}
        <WorkflowStage
          stageNumber={1}
          title={STAGE_TITLES.context}
          summary={getStageSummary("context")}
          status={getStageStatus("context")}
          onToggle={() => goToStage("context")}
        >
          <ContextStage
            projects={projects}
            selectedProjectId={selectedProjectId}
            taskType={taskType}
            onProjectChange={setSelectedProjectId}
            onTaskTypeChange={(tt) => {
              setTaskType(tt);
              setSelectedModel(getDefaultModelForTask(tt));
            }}
            onContinue={handleContextContinue}
            disabled={busyAction !== null}
          />
        </WorkflowStage>

        {/* Intent stage */}
        <WorkflowStage
          stageNumber={2}
          title={STAGE_TITLES.intent}
          summary={getStageSummary("intent")}
          status={getStageStatus("intent")}
          onToggle={() => goToStage("intent")}
        >
          <IntentStage
            roughIntent={roughIntent}
            taskType={taskType}
            onIntentChange={setRoughIntent}
            onContinue={handleIntentContinue}
            onContinueAfterReformulate={() => handleIntentContinue(true)}
            onSkipToModel={handleIntentSkipToModel}
            reformulateIntent={handleReformulateIntent}
            disabled={busyAction !== null}
          />
        </WorkflowStage>

        {/* Clarify stage */}
        <WorkflowStage
          stageNumber={3}
          title={STAGE_TITLES.clarify}
          summary={getStageSummary("clarify")}
          status={getStageStatus("clarify")}
          onToggle={() => goToStage("clarify")}
        >
          <ClarifyStage
            rounds={clarifyRounds}
            currentQuestions={currentClarifyResult?.questions ?? []}
            answersByQuestionId={answersByQuestionId}
            onAnswerChange={(qId, val) =>
              setAnswersByQuestionId((prev) => ({ ...prev, [qId]: val }))
            }
            onSubmitAndContinue={handleClarifySubmitAndContinue}
            onRequestAnotherRound={handleClarifyAnotherRound}
            onSkip={handleClarifySkip}
            loading={busyAction === "clarify"}
            disabled={busyAction !== null}
          />
        </WorkflowStage>

        {/* Model stage */}
        <WorkflowStage
          stageNumber={4}
          title={STAGE_TITLES.model}
          summary={getStageSummary("model")}
          status={getStageStatus("model")}
          onToggle={() => goToStage("model")}
        >
          <ModelStage
            recommendation={routeResult}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            onAccept={() => void handleModelAccept()}
            loading={busyAction === "route"}
            disabled={busyAction !== null}
          />
        </WorkflowStage>

        {/* Compile stage */}
        <WorkflowStage
          stageNumber={5}
          title={STAGE_TITLES.compile}
          summary={getStageSummary("compile")}
          status={getStageStatus("compile")}
          onToggle={() => goToStage("compile")}
        >
          <CompileStage
            compiledPrompt={latestCompiledPrompt}
            targetModel={selectedModel}
            versions={compiledVersions}
            onCopy={handleCopyPrompt}
            onReviseIntent={() => goToStage("intent")}
            onChangeModel={() => goToStage("model")}
            onRegenerate={() => void handleCompileRequest()}
            onIterateFrom={(label) => void handleCompileRequest(label)}
            onContinue={handleCompileContinue}
            loading={busyAction === "compile"}
            disabled={busyAction !== null}
          />
        </WorkflowStage>

        {/* Save stage */}
        <WorkflowStage
          stageNumber={6}
          title={STAGE_TITLES.save}
          summary={getStageSummary("save")}
          status={getStageStatus("save")}
        >
          <SaveStage
            title={libraryTitle}
            targetModel={selectedModel}
            expectedResultAssessment={expectedResultAssessment}
            effectivenessRating={effectivenessRating}
            onTitleChange={setLibraryTitle}
            onAssessmentChange={setExpectedResultAssessment}
            onRatingChange={setEffectivenessRating}
            onSave={() => void handleSaveToLibrary()}
            loading={busyAction === "save"}
            disabled={busyAction !== null}
            successMessage={saveMessage}
          />
        </WorkflowStage>
      </div>

      {errorMessage && <p className="status-error">{errorMessage}</p>}
    </section>
  );
}

// ── Page header (extracted for readability) ──

function PageHeader() {
  return (
    <div className="grid gap-3">
      <p className="eyebrow">Workbench</p>
      <h2 className="page-title">Build a prompt step by step</h2>
      <p className="page-description">
        Move through each stage in order: pick the project, describe the task,
        tighten the unknowns, choose a model, then compile a prompt worth
        saving.
      </p>
    </div>
  );
}

export default WorkbenchPage;
