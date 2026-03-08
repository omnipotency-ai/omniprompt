export type ModelChoice = "gpt-5.4" | "gpt-5-mini" | "claude-sonnet-4-6";
export type TaskType = "refactor" | "audit" | "frontend_iteration";
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

export interface Prompt {
  id: string;
  project_id: string;
  task_type: TaskType;
  session_id: string | null;
  title: string | null;
  rough_intent: string;
  compiled_prompt: string;
  target_model: ModelChoice;
  why_it_works: string;
  effectiveness_rating: number | null;
  created_at: string;
}

export interface PromptCreateRequest {
  project_id: string;
  task_type: TaskType;
  session_id?: string;
  title?: string;
  rough_intent: string;
  compiled_prompt: string;
  target_model: ModelChoice;
  why_it_works: string;
  effectiveness_rating: number;
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

export type SessionStatus = "open" | "closed";

export interface SessionNote {
  id: string;
  body: string;
  created_at: string;
}

export interface Session {
  id: string;
  project_id: string | null;
  task_type: TaskType | null;
  title: string | null;
  rough_intent: string | null;
  clarifying_questions: ClarifyingQuestion[];
  clarifying_answers: ClarifyingAnswer[];
  route_result: RouteResponse | null;
  compile_result: CompileResponse | null;
  status: SessionStatus;
  notes: SessionNote[];
  created_at: string;
  updated_at: string;
}

export interface SessionCreateRequest {
  project_id?: string;
  task_type?: TaskType;
  title?: string;
  rough_intent?: string;
  clarifying_questions?: ClarifyingQuestion[];
  clarifying_answers?: ClarifyingAnswer[];
  route_result?: RouteResponse;
  compile_result?: CompileResponse;
  status?: SessionStatus;
}

export interface SessionUpdateRequest {
  project_id?: string;
  task_type?: TaskType;
  title?: string;
  rough_intent?: string;
  clarifying_questions?: ClarifyingQuestion[];
  clarifying_answers?: ClarifyingAnswer[];
  route_result?: RouteResponse | null;
  compile_result?: CompileResponse | null;
  status?: SessionStatus;
  note_body?: string;
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
  return (
    MODEL_OPTIONS.find((option) => option.value === model)?.label ??
    model
  );
}

export function getTaskLabel(task: TaskType): string {
  return (
    TASK_OPTIONS.find((option) => option.value === task)?.label ??
    task.replaceAll("_", " ")
  );
}

export function getDefaultModelForTask(task: TaskType): ModelChoice {
  if (task === "frontend_iteration") {
    return "claude-sonnet-4-6";
  }
  return "gpt-5.4";
}

export const TASK_OPTIONS: TaskOption[] = [
  {
    value: "refactor",
    label: "Refactor",
    summary: "Untangle an overgrown codebase without widening the blast radius.",
  },
  {
    value: "frontend_iteration",
    label: "Frontend Iteration",
    summary:
      "Improve an existing UI or flow without reframing it as a full refactor or audit.",
  },
  {
    value: "audit",
    label: "Audit",
    summary: "Inspect necessity, duplication, structure, or fit against intent.",
  },
];

export const MODEL_OPTIONS: ModelOption[] = [
  {
    value: "gpt-5.4",
    label: "GPT-5.4",
    summary: "Use for ambiguous, cross-file, or synthesis-heavy coding work.",
    bestFor: "Broad refactors and evidence-heavy audits.",
  },
  {
    value: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    summary:
      "Use for structured React/TypeScript work and medium-complexity connected systems.",
    bestFor: "Frontend-heavy refactors, UI audits, and disciplined multi-file execution.",
  },
  {
    value: "gpt-5-mini",
    label: "GPT-5 Mini",
    summary: "Use for prescriptive, bounded, lower-cost coding tasks.",
    bestFor: "Narrow audits and clearly scoped cleanups.",
  },
];
