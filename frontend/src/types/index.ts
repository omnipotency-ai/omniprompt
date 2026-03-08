export type ModelChoice =
  | "gpt-5.4"
  | "gpt-5-mini"
  | "gpt-4.1"
  | "claude-opus-4-6"
  | "claude-sonnet-4-6"
  | "claude-haiku-4-5"
  | "gemini-3.0-flash"
  | "gemini-3.0-pro"
  | "kimi-k2.5"
  | "minimax-m2.5";

export type TaskType = "refactor" | "frontend" | "audit" | "implement";
export type SessionStatus = "draft" | "open" | "closed";
export type ComplexityLevel = "low" | "medium" | "high";
export type QuestionInputType = "single_choice" | "multi_choice" | "free_text";

export interface Project {
  id: string;
  name: string;
  path: string;
  repo_map_path: string | null;
  created_at: string;
  updated_at: string;
  last_mapped_at: string | null;
}

export interface ProjectCreateRequest {
  name: string;
  path: string;
}

export interface RepoMapFile {
  path: string;
  extension: string | null;
  language: string | null;
  size_bytes: number;
  exports: string[];
}

export interface RepoMap {
  project_id: string;
  project_name: string;
  project_path: string;
  generated_at: string;
  file_count: number;
  tree_lines: string[];
  files: RepoMapFile[];
  summary: string;
}

export interface ProjectMapResponse {
  project: Project;
  repo_map: RepoMap;
}

export interface ClarifyingOption {
  label: string;
  value: string;
}

export interface ClarifyingQuestion {
  id: string;
  question: string;
  input_type: QuestionInputType;
  options: ClarifyingOption[];
  placeholder: string | null;
}

export interface ClarifyingAnswer {
  question_id: string;
  question?: string;
  answer: string;
}

export interface ClarifyRound {
  id: string;
  round_number: number;
  questions: ClarifyingQuestion[];
  answers: ClarifyingAnswer[];
  created_at: string;
}

export interface CompiledVersion {
  id: string;
  version_label: string;
  compiled_prompt: string;
  target_model: ModelChoice;
  project_context_used: boolean;
  created_at: string;
}

export interface ClarifyRequest {
  project_id?: string;
  task_type: TaskType;
  rough_intent: string;
}

export interface ClarifyResponse {
  task_type: TaskType;
  questions: ClarifyingQuestion[];
  project_context_used: boolean;
}

export interface RouteRequest {
  project_id?: string;
  task_type: TaskType;
  rough_intent: string;
  answers: ClarifyingAnswer[];
}

export interface RouteResponse {
  task_type: TaskType;
  recommended_model: ModelChoice;
  estimated_complexity: ComplexityLevel;
  reasoning: string;
  budget_alternative: ModelChoice | null;
  advisory_only: boolean;
}

export interface CompileRequest {
  project_id?: string;
  task_type: TaskType;
  rough_intent: string;
  answers: ClarifyingAnswer[];
  target_model: ModelChoice;
}

export interface CompileResponse {
  task_type: TaskType;
  target_model: ModelChoice;
  compiled_prompt: string;
  project_context_used: boolean;
}

export interface Session {
  id: string;
  project_id: string | null;
  task_type: TaskType | null;
  title: string | null;
  rough_intent: string | null;
  reformulated_intent: string | null;
  selected_model: ModelChoice | null;
  clarify_rounds: ClarifyRound[];
  route_result: RouteResponse | null;
  compiled_versions: CompiledVersion[];
  status: SessionStatus;
  created_at: string;
  updated_at: string;
}

export interface SessionCreateRequest {
  project_id?: string;
  task_type?: TaskType;
  title?: string;
  rough_intent?: string;
  status?: SessionStatus;
}

export interface SessionUpdateRequest {
  project_id?: string;
  task_type?: TaskType;
  title?: string;
  rough_intent?: string;
  reformulated_intent?: string;
  selected_model?: ModelChoice;
  append_clarify_round?: ClarifyRound;
  route_result?: RouteResponse | null;
  append_compiled_version?: CompiledVersion;
  status?: SessionStatus;
}

export interface Prompt {
  id: string;
  project_id: string;
  task_type: TaskType;
  session_id: string | null;
  compiled_version_id: string | null;
  title: string | null;
  rough_intent: string;
  compiled_prompt: string;
  target_model: ModelChoice;
  expected_result_assessment: string | null;
  effectiveness_rating: number | null;
  created_at: string;
}

export interface PromptCreateRequest {
  project_id: string;
  task_type: TaskType;
  session_id?: string;
  compiled_version_id?: string;
  title?: string;
  rough_intent: string;
  compiled_prompt: string;
  target_model: ModelChoice;
  expected_result_assessment?: string;
  effectiveness_rating?: number;
}

export interface TaskOption {
  value: TaskType;
  label: string;
  summary: string;
}

export interface ModelOption {
  value: ModelChoice;
  label: string;
  summary: string;
  bestFor: string;
}

export function getModelLabel(model: ModelChoice): string {
  return MODEL_OPTIONS.find((option) => option.value === model)?.label ?? model;
}

export function getTaskLabel(task: TaskType): string {
  return (
    TASK_OPTIONS.find((option) => option.value === task)?.label ??
    task.replaceAll("_", " ")
  );
}

export function getDefaultModelForTask(task: TaskType): ModelChoice {
  if (task === "frontend") return "claude-sonnet-4-6";
  if (task === "implement") return "gpt-5-mini";
  return "gpt-5.4";
}

export const TASK_OPTIONS: TaskOption[] = [
  {
    value: "refactor",
    label: "Refactor",
    summary: "Restructure code without changing its intended behavior.",
  },
  {
    value: "frontend",
    label: "Frontend",
    summary: "Change UI, layout, interactions, styling, or UX flows.",
  },
  {
    value: "audit",
    label: "Audit",
    summary:
      "Evaluate quality, security, performance, maintainability, or duplication.",
  },
  {
    value: "implement",
    label: "Implement",
    summary: "Small, concrete, prescriptive changes with no ambiguity.",
  },
];

export const MODEL_OPTIONS: ModelOption[] = [
  {
    value: "gpt-5.4",
    label: "GPT-5.4",
    summary: "Best for ambiguous, cross-file, or synthesis-heavy work.",
    bestFor: "Broad refactors and evidence-heavy audits.",
  },
  {
    value: "claude-opus-4-6",
    label: "Claude Opus 4.6",
    summary: "Highest reasoning capability for complex, long-horizon tasks.",
    bestFor: "Architecture decisions, deep analysis, multi-step planning.",
  },
  {
    value: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    summary: "Structured React/TypeScript work and connected systems.",
    bestFor: "Frontend refactors, UI audits, disciplined multi-file execution.",
  },
  {
    value: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    summary: "Fast and cost-efficient for bounded, well-specified tasks.",
    bestFor: "Narrow, prescriptive changes with clear acceptance criteria.",
  },
  {
    value: "gemini-3.0-pro",
    label: "Gemini 3.0 Pro",
    summary: "Strong at long-context reasoning and multimodal tasks.",
    bestFor: "Large codebase analysis and cross-modal work.",
  },
  {
    value: "gemini-3.0-flash",
    label: "Gemini 3.0 Flash",
    summary: "Fast Gemini model for routine tasks.",
    bestFor: "Quick iterations and lower-complexity tasks.",
  },
  {
    value: "gpt-4.1",
    label: "GPT-4.1",
    summary: "Reliable general-purpose model for coding and analysis.",
    bestFor: "Standard coding tasks and documentation.",
  },
  {
    value: "gpt-5-mini",
    label: "GPT-5 Mini",
    summary: "Lightweight and fast for prescriptive, bounded tasks.",
    bestFor: "Narrow audits and clearly scoped cleanups.",
  },
  {
    value: "kimi-k2.5",
    label: "Kimi K2.5",
    summary: "Strong at long-context and code-heavy tasks.",
    bestFor: "Large file analysis and agentic coding work.",
  },
  {
    value: "minimax-m2.5",
    label: "Minimax M2.5",
    summary: "Efficient model for structured output tasks.",
    bestFor: "Batch processing and structured generation.",
  },
];
