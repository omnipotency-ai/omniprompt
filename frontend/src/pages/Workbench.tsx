import { useEffect, useMemo, useState } from "react";

import {
  clarifyIntent,
  compilePrompt,
  createSession,
  getLatestSession,
  listProjects,
  listSessions,
  routeModel,
  savePromptToLibrary,
  updateSession,
} from "../api/client";
import { ClarifyingQuestions } from "../components/ClarifyingQuestions";
import { CompiledOutput } from "../components/CompiledOutput";
import { IntentInput } from "../components/IntentInput";
import { ModelSelector } from "../components/ModelSelector";
import { ProjectSelector } from "../components/ProjectSelector";
import { SessionSidebar } from "../components/SessionSidebar";
import {
  TASK_OPTIONS,
  getDefaultModelForTask,
  getModelLabel,
  type ClarifyResponse,
  type ClarifyingAnswer,
  type CompileResponse,
  type ModelChoice,
  type Project,
  type RouteResponse,
  type Session,
  type SessionCreateRequest,
  type TaskType,
} from "../types";

type BusyStep = "loading" | "clarify" | "route" | "compile" | "library" | null;
type SessionBusyAction = "start" | "sync" | "note" | "close" | null;

type WorkbenchPageProps = {
  refreshKey: number;
  onOpenProjects: () => void;
};

function deriveSessionTitle(roughIntent: string, taskType: TaskType) {
  const compact = roughIntent.trim().replace(/\s+/g, " ");
  if (compact) {
    return compact.slice(0, 160);
  }
  const humanizedTask = taskType
    .replaceAll("_", " ")
    .replace(/\b\w/g, (value) => value.toUpperCase());
  return `${humanizedTask} session`;
}

export function WorkbenchPage({
  refreshKey,
  onOpenProjects,
}: WorkbenchPageProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [latestOpenSession, setLatestOpenSession] = useState<Session | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("refactor");
  const [roughIntent, setRoughIntent] = useState("");
  const [clarifyResult, setClarifyResult] = useState<ClarifyResponse | null>(null);
  const [answersByQuestionId, setAnswersByQuestionId] = useState<Record<string, string>>(
    {},
  );
  const [routeResult, setRouteResult] = useState<RouteResponse | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelChoice>(
    getDefaultModelForTask("refactor"),
  );
  const [compileResult, setCompileResult] = useState<CompileResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const [libraryTitle, setLibraryTitle] = useState("");
  const [effectivenessRating, setEffectivenessRating] = useState("5");
  const [whyItWorks, setWhyItWorks] = useState("");
  const [libraryMessage, setLibraryMessage] = useState<string | null>(null);

  const [busyStep, setBusyStep] = useState<BusyStep>("loading");
  const [sessionBusyAction, setSessionBusyAction] = useState<SessionBusyAction>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentSession = useMemo(
    () => sessions.find((session) => session.id === currentSessionId) ?? null,
    [currentSessionId, sessions],
  );

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const clarifyingAnswers: ClarifyingAnswer[] = useMemo(() => {
    if (!clarifyResult) {
      return [];
    }

    return clarifyResult.questions.flatMap((question) => {
      const answer = answersByQuestionId[question.id]?.trim();
      if (!answer) {
        return [];
      }

      return [
        {
          question_id: question.id,
          question: question.question,
          answer,
        },
      ];
    });
  }, [answersByQuestionId, clarifyResult]);

  const answeredCount = clarifyingAnswers.length;
  const totalQuestions = clarifyResult?.questions.length ?? 0;

  const recommendedAction = !roughIntent.trim()
    ? null
    : !clarifyResult
      ? "clarify"
      : !routeResult
        ? "route"
        : !compileResult
          ? "compile"
          : null;

  const nextStepCopy = compileResult
    ? "Copy the prompt or save it with a short note so the library captures why it worked."
    : routeResult
      ? "The model recommendation is ready. Keep it or override it, then compile the final prompt."
      : clarifyResult
        ? "Answer the questions that still matter, then route or compile once the job is concrete enough."
        : roughIntent.trim()
          ? "If the ask still has ambiguity, generate clarifying questions before you compile."
          : "Describe the task and the constraints you want preserved before moving to model selection.";

  const workflowCards = [
    {
      label: "1. Context",
      detail: selectedProject
        ? `${selectedProject.name}${selectedProject.repo_map_path ? " · repo map ready" : " · repo map missing"}`
        : "Choose a project to ground the prompt in a repo map.",
      state: selectedProject ? "ready" : "active",
    },
    {
      label: "2. Intent",
      detail: roughIntent.trim()
        ? "Intent captured and ready for refinement."
        : "Describe the actual job before routing or compiling.",
      state: roughIntent.trim() ? "ready" : selectedProject ? "active" : "idle",
    },
    {
      label: "3. Clarify",
      detail: clarifyResult
        ? `${answeredCount}/${totalQuestions} questions answered.`
        : "Generate clarifying questions only when the job still feels underspecified.",
      state: clarifyResult
        ? totalQuestions === 0 || answeredCount === totalQuestions
          ? "ready"
          : "active"
        : roughIntent.trim()
          ? "active"
          : "idle",
    },
    {
      label: "4. Route + compile",
      detail: compileResult
        ? `Prompt ready for ${getModelLabel(compileResult.target_model)}.`
        : routeResult
          ? `Recommendation ready: ${getModelLabel(routeResult.recommended_model)}.`
          : "Pick the target model, then compile the final prompt artifact.",
      state: compileResult ? "ready" : routeResult || roughIntent.trim() ? "active" : "idle",
    },
  ] as const;

  useEffect(() => {
    let cancelled = false;

    async function loadWorkbenchContext() {
      setBusyStep("loading");
      setErrorMessage(null);

      try {
        const [nextProjects, nextSessions, nextLatestSession] = await Promise.all([
          listProjects(),
          listSessions(),
          getLatestSession(),
        ]);

        if (cancelled) {
          return;
        }

        setProjects(nextProjects);
        setSessions(nextSessions);
        setLatestOpenSession(nextLatestSession);
        setSelectedProjectId((current) =>
          current && nextProjects.some((project) => project.id === current)
            ? current
            : nextProjects[0]?.id ?? "",
        );
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : "Failed to load the workbench.",
          );
        }
      } finally {
        if (!cancelled) {
          setBusyStep(null);
        }
      }
    }

    void loadWorkbenchContext();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  function resetDownstreamState(nextTaskType: TaskType = taskType) {
    setClarifyResult(null);
    setAnswersByQuestionId({});
    setRouteResult(null);
    setCompileResult(null);
    setCopied(false);
    setSelectedModel(getDefaultModelForTask(nextTaskType));
    setLibraryTitle(deriveSessionTitle(roughIntent, nextTaskType));
    setWhyItWorks("");
    setLibraryMessage(null);
  }

  function getSessionPayload(): SessionCreateRequest {
    return {
      project_id: selectedProjectId || undefined,
      task_type: taskType,
      title: deriveSessionTitle(roughIntent, taskType),
      rough_intent: roughIntent.trim() || undefined,
      clarifying_questions: clarifyResult?.questions ?? [],
      clarifying_answers: clarifyingAnswers,
      route_result: routeResult ?? undefined,
      compile_result: compileResult ?? undefined,
      status: "open",
    };
  }

  async function refreshSessionsState(preferredSessionId: string | null = currentSessionId) {
    const [nextSessions, nextLatestSession] = await Promise.all([
      listSessions(),
      getLatestSession(),
    ]);
    setSessions(nextSessions);
    setLatestOpenSession(nextLatestSession);
    if (preferredSessionId && nextSessions.some((session) => session.id === preferredSessionId)) {
      setCurrentSessionId(preferredSessionId);
    } else if (!preferredSessionId) {
      setCurrentSessionId(null);
    }
  }

  function applySession(session: Session) {
    setCurrentSessionId(session.id);
    setSelectedProjectId(session.project_id ?? selectedProjectId);

    const nextTaskType = session.task_type ?? "refactor";
    setTaskType(nextTaskType);
    setRoughIntent(session.rough_intent ?? "");

    if (session.clarifying_questions.length > 0) {
      setClarifyResult({
        task_type: nextTaskType,
        questions: session.clarifying_questions,
        project_context_used: Boolean(session.project_id),
      });
    } else {
      setClarifyResult(null);
    }

    setAnswersByQuestionId(
      Object.fromEntries(
        session.clarifying_answers.map((answer) => [answer.question_id, answer.answer]),
      ),
    );
    setRouteResult(session.route_result);
    setCompileResult(session.compile_result);
    setSelectedModel(
      session.compile_result?.target_model ??
        session.route_result?.recommended_model ??
        getDefaultModelForTask(nextTaskType),
    );
    setLibraryTitle(
      session.compile_result?.task_type
        ? deriveSessionTitle(session.rough_intent ?? "", session.compile_result.task_type)
        : deriveSessionTitle(session.rough_intent ?? "", nextTaskType),
    );
    setCopied(false);
    setLibraryMessage(null);
    setErrorMessage(null);
  }

  async function syncCurrentSession() {
    if (!currentSessionId) {
      return;
    }
    setSessionBusyAction("sync");
    setErrorMessage(null);
    try {
      await updateSession(currentSessionId, getSessionPayload());
      await refreshSessionsState(currentSessionId);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save the session state.",
      );
    } finally {
      setSessionBusyAction(null);
    }
  }

  async function handleStartSession() {
    setSessionBusyAction("start");
    setErrorMessage(null);
    try {
      const session = await createSession(getSessionPayload());
      await refreshSessionsState(session.id);
      setCurrentSessionId(session.id);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to start a session.",
      );
    } finally {
      setSessionBusyAction(null);
    }
  }

  async function handleAddSessionNote(noteBody: string) {
    setSessionBusyAction("note");
    setErrorMessage(null);
    try {
      let sessionId = currentSessionId;
      if (!sessionId) {
        const session = await createSession(getSessionPayload());
        sessionId = session.id;
        setCurrentSessionId(session.id);
      }
      await updateSession(sessionId, { ...getSessionPayload(), note_body: noteBody });
      await refreshSessionsState(sessionId);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save the note.",
      );
    } finally {
      setSessionBusyAction(null);
    }
  }

  async function handleCloseSession() {
    if (!currentSessionId) {
      return;
    }
    setSessionBusyAction("close");
    setErrorMessage(null);
    try {
      await updateSession(currentSessionId, {
        ...getSessionPayload(),
        status: "closed",
      });
      await refreshSessionsState(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to close the session.",
      );
    } finally {
      setSessionBusyAction(null);
    }
  }

  async function handleClarify() {
    if (!roughIntent.trim()) {
      setErrorMessage("Add a rough intent before asking for clarifying questions.");
      return;
    }

    setBusyStep("clarify");
    setErrorMessage(null);
    setLibraryMessage(null);
    setRouteResult(null);
    setCompileResult(null);

    try {
      const response = await clarifyIntent({
        project_id: selectedProjectId || undefined,
        task_type: taskType,
        rough_intent: roughIntent.trim(),
      });

      setClarifyResult(response);
      setAnswersByQuestionId({});
      setCopied(false);
      if (currentSessionId) {
        await updateSession(currentSessionId, {
          ...getSessionPayload(),
          clarifying_questions: response.questions,
          clarifying_answers: [],
          route_result: null,
          compile_result: null,
        });
        await refreshSessionsState(currentSessionId);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to generate questions.",
      );
    } finally {
      setBusyStep(null);
    }
  }

  async function handleRecommendModel() {
    if (!roughIntent.trim()) {
      setErrorMessage("Add a rough intent before asking for a recommendation.");
      return;
    }

    setBusyStep("route");
    setErrorMessage(null);
    setLibraryMessage(null);
    setCompileResult(null);

    try {
      const response = await routeModel({
        project_id: selectedProjectId || undefined,
        task_type: taskType,
        rough_intent: roughIntent.trim(),
        answers: clarifyingAnswers,
      });

      setRouteResult(response);
      setSelectedModel(response.recommended_model);
      setCopied(false);
      if (currentSessionId) {
        await updateSession(currentSessionId, {
          ...getSessionPayload(),
          route_result: response,
          compile_result: null,
        });
        await refreshSessionsState(currentSessionId);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to recommend a model.",
      );
    } finally {
      setBusyStep(null);
    }
  }

  async function handleCompile() {
    if (!roughIntent.trim()) {
      setErrorMessage("Add a rough intent before compiling a prompt.");
      return;
    }

    setBusyStep("compile");
    setErrorMessage(null);
    setLibraryMessage(null);

    try {
      const response = await compilePrompt({
        project_id: selectedProjectId || undefined,
        task_type: taskType,
        rough_intent: roughIntent.trim(),
        answers: clarifyingAnswers,
        target_model: selectedModel,
      });

      setCompileResult(response);
      setLibraryTitle(deriveSessionTitle(roughIntent, taskType));
      setCopied(false);
      if (currentSessionId) {
        await updateSession(currentSessionId, {
          ...getSessionPayload(),
          compile_result: response,
        });
        await refreshSessionsState(currentSessionId);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to compile the prompt.",
      );
    } finally {
      setBusyStep(null);
    }
  }

  async function handleCopyCompiledPrompt() {
    if (!compileResult?.compiled_prompt) {
      return;
    }

    try {
      await navigator.clipboard.writeText(compileResult.compiled_prompt);
      setCopied(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to copy the prompt.",
      );
    }
  }

  async function handleSavePrompt() {
    if (!compileResult?.compiled_prompt) {
      return;
    }
    if (!selectedProjectId) {
      setErrorMessage("Choose a project before saving a prompt to the library.");
      return;
    }
    if (!whyItWorks.trim()) {
      setErrorMessage("Add a why-it-worked note before saving.");
      return;
    }

    setBusyStep("library");
    setErrorMessage(null);
    setLibraryMessage(null);
    try {
      await savePromptToLibrary({
        project_id: selectedProjectId,
        task_type: compileResult.task_type,
        session_id: currentSessionId ?? undefined,
        title: libraryTitle.trim() || undefined,
        rough_intent: roughIntent.trim(),
        compiled_prompt: compileResult.compiled_prompt,
        target_model: compileResult.target_model,
        why_it_works: whyItWorks.trim(),
        effectiveness_rating: Number(effectivenessRating),
      });
      setLibraryMessage("Prompt saved to the library.");
      setWhyItWorks("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save the prompt.",
      );
    } finally {
      setBusyStep(null);
    }
  }

  return (
    <section className="grid gap-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="grid gap-3">
          <p className="eyebrow">Workbench</p>
          <h2 className="page-title">Compile a prompt without losing the thread</h2>
          <p className="page-description">
            Move from project context to final prompt in a clear sequence: pick the
            repo, define the task, tighten the unknowns, then compile an artifact
            worth saving.
          </p>
        </div>

        <div className="panel-subtle grid gap-3 xl:min-w-[20rem] xl:max-w-[24rem]">
          <p className="eyebrow">Current setup</p>
          <div className="grid gap-2 text-sm leading-6 text-ink-700">
            <div className="flex items-center justify-between gap-3">
              <span>Project</span>
              <strong className="text-right text-ink-900">
                {selectedProject?.name ?? "Not selected"}
              </strong>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Task</span>
              <strong className="text-right text-ink-900">
                {TASK_OPTIONS.find((option) => option.value === taskType)?.label}
              </strong>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Target model</span>
              <strong className="text-right text-ink-900">
                {getModelLabel(compileResult?.target_model ?? selectedModel)}
              </strong>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Session</span>
              <strong className="text-right text-ink-900">
                {currentSession ? "Active" : "Not started"}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {projects.length === 0 ? (
        <section className="panel grid gap-4 p-6">
          <h3 className="section-title text-[1.45rem]">No projects registered yet</h3>
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
      ) : (
        <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="min-w-0 xl:sticky xl:top-6 xl:self-start">
            <div className="xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto xl:pr-1">
              <SessionSidebar
                sessions={sessions}
                latestOpenSession={latestOpenSession}
                currentSession={currentSession}
                busyAction={sessionBusyAction}
                disabled={busyStep !== null}
                onStartSession={() => void handleStartSession()}
                onResumeSession={applySession}
                onSyncSession={() => void syncCurrentSession()}
                onAddNote={handleAddSessionNote}
                onCloseSession={() => void handleCloseSession()}
              />
            </div>
          </div>

          <div className="grid gap-6">
            <section className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
              {workflowCards.map((card) => (
                <article
                  key={card.label}
                  className={`flow-card ${
                    card.state === "ready"
                      ? "flow-card-ready"
                      : card.state === "active"
                        ? "flow-card-active"
                        : ""
                  }`}
                >
                  <p className="field-label">{card.label}</p>
                  <p className="mt-2 text-sm leading-6 text-ink-900">{card.detail}</p>
                </article>
              ))}
            </section>

            <section className="panel grid gap-6 p-6">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <ProjectSelector
                  projects={projects}
                  value={selectedProjectId}
                  onChange={(projectId) => {
                    setSelectedProjectId(projectId);
                    setRouteResult(null);
                    setCompileResult(null);
                    setCopied(false);
                    setLibraryMessage(null);
                  }}
                />

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <p className="field-label">Task type</p>
                    <p className="section-copy content-clamp">
                      Tell the compiler what kind of help you want so the follow-up
                      questions and final prompt stay in the right mode.
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    {TASK_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`grid gap-2 rounded-[1.05rem] border px-4 py-4 text-left transition hover:-translate-y-0.5 ${
                          taskType === option.value
                            ? "border-clay-500/35 bg-white shadow-[0_14px_34px_rgba(16,24,40,0.08)]"
                            : "border-black/10 bg-sand-50/85 hover:border-clay-500/20 hover:bg-white"
                        }`}
                        onClick={() => {
                          setTaskType(option.value);
                          resetDownstreamState(option.value);
                        }}
                      >
                        <span className="font-semibold text-ink-900">{option.label}</span>
                        <span className="text-sm leading-6 text-ink-700">
                          {option.summary}
                        </span>
                      </button>
                    ))}
                  </div>

                </div>
              </div>
            </section>

            <section className="panel grid gap-5 p-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="grid gap-2">
                  <p className="field-label">Next step</p>
                  <h3 className="section-title text-[1.45rem]">
                    Shape the request before you spend tokens
                  </h3>
                  <p className="section-copy content-clamp">
                    Write the job in plain language first. Once the task is readable,
                    use clarification and model routing only where they add signal.
                  </p>
                </div>

                <div className="panel-subtle grid gap-2 xl:min-w-[18rem] xl:max-w-[22rem]">
                  <span className="badge badge-accent">Workflow guidance</span>
                  <p className="text-sm font-semibold text-ink-900">
                    {recommendedAction === "compile"
                      ? "Suggested next: compile the prompt"
                      : recommendedAction === "route"
                        ? "Suggested next: recommend a model"
                        : recommendedAction === "clarify"
                          ? "Suggested next: generate clarifying questions"
                          : "Suggested next: write the intent"}
                  </p>
                  <p className="text-sm leading-6 text-ink-700">{nextStepCopy}</p>
                </div>
              </div>

              <IntentInput
                value={roughIntent}
                onChange={(value) => {
                  setRoughIntent(value);
                  setRouteResult(null);
                  setCompileResult(null);
                  setCopied(false);
                  setLibraryMessage(null);
                }}
                taskType={taskType}
              />

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className={`btn ${recommendedAction === "clarify" ? "btn-primary" : "btn-muted"}`}
                  onClick={() => void handleClarify()}
                  disabled={busyStep !== null}
                >
                  {busyStep === "clarify"
                    ? "Generating questions..."
                    : "Get clarifying questions"}
                </button>
                <button
                  type="button"
                  className={`btn ${recommendedAction === "route" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => void handleRecommendModel()}
                  disabled={busyStep !== null}
                >
                  {busyStep === "route" ? "Routing..." : "Recommend model"}
                </button>
                <button
                  type="button"
                  className={`btn ${recommendedAction === "compile" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => void handleCompile()}
                  disabled={busyStep !== null}
                >
                  {busyStep === "compile" ? "Compiling..." : "Compile prompt"}
                </button>
              </div>

              {errorMessage ? <p className="status-error">{errorMessage}</p> : null}
              {libraryMessage ? <p className="status-success">{libraryMessage}</p> : null}
            </section>

            {clarifyResult?.questions.length ? (
              <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
                <ClarifyingQuestions
                  questions={clarifyResult.questions}
                  answersByQuestionId={answersByQuestionId}
                  onAnswerChange={(question, answer) => {
                    setAnswersByQuestionId((current) => ({
                      ...current,
                      [question.id]: answer,
                    }));
                    setRouteResult(null);
                    setCompileResult(null);
                    setCopied(false);
                    setLibraryMessage(null);
                  }}
                  onRecommendModel={() => void handleRecommendModel()}
                  onCompilePrompt={() => void handleCompile()}
                  busyAction={
                    busyStep === "route"
                      ? "route"
                      : busyStep === "compile"
                        ? "compile"
                        : null
                  }
                  disabled={busyStep !== null}
                />

                <ModelSelector
                  taskType={taskType}
                  selectedModel={selectedModel}
                  recommendation={routeResult}
                  compact
                  onChange={(model) => {
                    setSelectedModel(model);
                    setCompileResult(null);
                    setCopied(false);
                    setLibraryMessage(null);
                  }}
                />
              </div>
            ) : (
              <ModelSelector
                taskType={taskType}
                selectedModel={selectedModel}
                recommendation={routeResult}
                onChange={(model) => {
                  setSelectedModel(model);
                  setCompileResult(null);
                  setCopied(false);
                  setLibraryMessage(null);
                }}
              />
            )}

            <CompiledOutput
              taskType={compileResult?.task_type ?? taskType}
              targetModel={compileResult?.target_model ?? selectedModel}
              compiledPrompt={compileResult?.compiled_prompt ?? ""}
              projectContextUsed={compileResult?.project_context_used ?? false}
              onCopy={handleCopyCompiledPrompt}
              copied={copied}
            />

            {compileResult ? (
              <section className="panel grid gap-5 p-6">
                <div className="grid gap-2">
                  <p className="field-label">Save to library</p>
                  <h3 className="section-title text-[1.35rem]">
                    Capture what made this prompt useful
                  </h3>
                  <p className="section-copy content-clamp">
                    Rate the result and leave a short note about the framing or
                    guardrails that made it work so the library stays searchable and
                    reusable.
                  </p>
                </div>

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_12rem]">
                  <label className="grid gap-2">
                    <span className="field-label">Title</span>
                    <input
                      value={libraryTitle}
                      onChange={(event) => setLibraryTitle(event.target.value)}
                      placeholder="Transit map categorization audit"
                      className="field-input"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="field-label">Effectiveness</span>
                    <select
                      value={effectivenessRating}
                      onChange={(event) => setEffectivenessRating(event.target.value)}
                      className="field-select"
                    >
                      {["5", "4", "3", "2", "1"].map((value) => (
                        <option key={value} value={value}>
                          {value}/5
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="grid gap-2">
                  <span className="field-label">Why this worked</span>
                  <textarea
                    value={whyItWorks}
                    onChange={(event) => setWhyItWorks(event.target.value)}
                    placeholder="Be concrete: which framing, guardrails, or repo context made the resulting prompt better?"
                    className="field-textarea min-h-36"
                  />
                </label>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="btn btn-dark"
                    onClick={() => void handleSavePrompt()}
                    disabled={busyStep !== null || !whyItWorks.trim()}
                  >
                    {busyStep === "library" ? "Saving..." : "Save to library"}
                  </button>
                </div>
              </section>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

export default WorkbenchPage;
