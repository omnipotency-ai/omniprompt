import type {
  ClarifyRequest,
  ClarifyResponse,
  CompileRequest,
  CompileResponse,
  Prompt,
  PromptCreateRequest,
  Project,
  ProjectCreateRequest,
  ProjectMapResponse,
  ReformulateRequest,
  ReformulateResponse,
  RouteRequest,
  RouteResponse,
  Session,
  SessionCreateRequest,
  SessionUpdateRequest,
} from "../types";

const rawEnv = (
  import.meta as ImportMeta & {
    env?: Record<string, string | undefined>;
  }
).env;

export const API_BASE_URL =
  rawEnv?.VITE_API_BASE_URL?.trim() || "http://127.0.0.1:8000";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type ApiRequestInit = Omit<RequestInit, "body"> & {
  body?: unknown;
};

async function request<T>(path: string, init?: ApiRequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");

  let body: BodyInit | undefined;
  if (init?.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    body,
  });

  const isJson = response.headers
    .get("content-type")
    ?.toLowerCase()
    .includes("application/json");

  const payload = isJson ? await response.json() : await response.text();
  if (!response.ok) {
    const message =
      typeof payload === "string"
        ? payload
        : typeof payload?.detail === "string"
          ? payload.detail
          : `Request failed with status ${response.status}`;
    throw new ApiError(response.status, message);
  }

  return payload as T;
}

export function listProjects(): Promise<Project[]> {
  return request<Project[]>("/api/projects");
}

export function createProject(input: ProjectCreateRequest): Promise<Project> {
  return request<Project>("/api/projects", {
    method: "POST",
    body: input,
  });
}

export function refreshProjectMap(
  projectId: string,
): Promise<ProjectMapResponse> {
  return request<ProjectMapResponse>(`/api/projects/${projectId}/map`, {
    method: "POST",
  });
}

export function reformulateIntent(
  input: ReformulateRequest,
): Promise<ReformulateResponse> {
  return request<ReformulateResponse>("/api/reformulate", {
    method: "POST",
    body: input,
  });
}

export function clarifyIntent(input: ClarifyRequest): Promise<ClarifyResponse> {
  return request<ClarifyResponse>("/api/clarify", {
    method: "POST",
    body: input,
  });
}

export function routeModel(input: RouteRequest): Promise<RouteResponse> {
  return request<RouteResponse>("/api/route", {
    method: "POST",
    body: input,
  });
}

export function compilePrompt(input: CompileRequest): Promise<CompileResponse> {
  return request<CompileResponse>("/api/compile", {
    method: "POST",
    body: input,
  });
}

export function listLibrary(): Promise<Prompt[]> {
  return request<Prompt[]>("/api/library");
}

export function savePromptToLibrary(
  input: PromptCreateRequest,
): Promise<Prompt> {
  return request<Prompt>("/api/library", {
    method: "POST",
    body: input,
  });
}

export function listSessions(): Promise<Session[]> {
  return request<Session[]>("/api/sessions");
}

export function getSession(sessionId: string): Promise<Session> {
  return request<Session>(`/api/sessions/${sessionId}`);
}

export function getLatestSession(): Promise<Session | null> {
  return request<Session | null>("/api/sessions/latest");
}

export function createSession(input: SessionCreateRequest): Promise<Session> {
  return request<Session>("/api/sessions", {
    method: "POST",
    body: input,
  });
}

export function updateSession(
  sessionId: string,
  input: SessionUpdateRequest,
): Promise<Session> {
  return request<Session>(`/api/sessions/${sessionId}`, {
    method: "PUT",
    body: input,
  });
}
