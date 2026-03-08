from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from json import JSONDecodeError
from pathlib import Path
from typing import Callable

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

try:
    from backend.clarifier import generate_clarifying_questions
    from backend.compiler import generate_compiled_prompt
    from backend.harvester import harvest_project
    from backend.models import (
        ClarifyRequest,
        ClarifyResponse,
        CompileRequest,
        CompileResponse,
        CompiledVersion,
        Prompt,
        PromptCreateRequest,
        Project,
        ProjectCreateRequest,
        ProjectMapResponse,
        RepoMap,
        RouteRequest,
        RouteResponse,
        Session,
        SessionCreateRequest,
        SessionUpdateRequest,
    )
    from backend.router import recommend_model
except ModuleNotFoundError:
    from clarifier import generate_clarifying_questions
    from compiler import generate_compiled_prompt
    from harvester import harvest_project
    from models import (
        ClarifyRequest,
        ClarifyResponse,
        CompileRequest,
        CompileResponse,
        CompiledVersion,
        Prompt,
        PromptCreateRequest,
        Project,
        ProjectCreateRequest,
        ProjectMapResponse,
        RepoMap,
        RouteRequest,
        RouteResponse,
        Session,
        SessionCreateRequest,
        SessionUpdateRequest,
    )
    from router import recommend_model

APP_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = APP_DIR.parent
DATA_DIR = PROJECT_ROOT / "data"
PROJECTS_FILE = DATA_DIR / "projects.json"
MAPS_DIR = DATA_DIR / "maps"
LIBRARY_DIR = DATA_DIR / "library"
SESSIONS_DIR = DATA_DIR / "sessions"
ENV_FILE = APP_DIR / ".env"

load_dotenv(ENV_FILE)


class ProjectRegistry:
    def __init__(self, registry_path: Path, on_read: Callable[[], None]) -> None:
        self._registry_path = registry_path
        self._on_read = on_read

    def list(self) -> list[Project]:
        self._on_read()
        try:
            raw_payload = json.loads(self._registry_path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            self._on_read()
            raw_payload = []
        except JSONDecodeError as exc:
            raise RuntimeError(
                f"Projects registry is not valid JSON: {self._registry_path}"
            ) from exc

        if not isinstance(raw_payload, list):
            raise RuntimeError(
                f"Projects registry must be a JSON array: {self._registry_path}"
            )

        try:
            return [Project.model_validate(item) for item in raw_payload]
        except ValidationError as exc:
            raise RuntimeError(
                f"Projects registry contains invalid project data: {self._registry_path}"
            ) from exc

    def get(self, project_id: str) -> Project | None:
        for project in self.list():
            if project.id == project_id:
                return project
        return None

    def create(self, project: Project) -> Project:
        projects = self.list()
        projects.append(project)
        self._write(projects)
        return project

    def update(self, project_id: str, updated_project: Project) -> Project:
        projects = self.list()
        for index, project in enumerate(projects):
            if project.id == project_id:
                projects[index] = updated_project
                self._write(projects)
                return updated_project
        raise KeyError(project_id)

    def delete(self, project_id: str) -> Project | None:
        projects = self.list()
        for index, project in enumerate(projects):
            if project.id == project_id:
                removed_project = projects.pop(index)
                self._write(projects)
                return removed_project
        return None

    def _write(self, projects: list[Project]) -> None:
        self._on_read()
        payload = [project.model_dump(mode="json") for project in projects]
        temp_path = self._registry_path.with_name(f"{self._registry_path.name}.tmp")
        temp_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        temp_path.replace(self._registry_path)


class PromptLibraryStore:
    def __init__(self, library_dir: Path, on_read: Callable[[], None]) -> None:
        self._library_dir = library_dir
        self._on_read = on_read

    def list(self) -> list[Prompt]:
        self._on_read()
        prompts = [_read_model_file(path, Prompt) for path in self._iter_prompt_paths()]
        return sorted(prompts, key=lambda prompt: prompt.created_at, reverse=True)

    def create(self, prompt: Prompt) -> Prompt:
        self._on_read()
        _write_json_file(
            self._library_dir / f"{prompt.id}.json",
            prompt.model_dump(mode="json"),
        )
        return prompt

    def _iter_prompt_paths(self) -> list[Path]:
        return sorted(
            (path for path in self._library_dir.glob("*.json") if path.is_file()),
            key=lambda path: path.name,
        )


class SessionStore:
    def __init__(self, sessions_dir: Path, on_read: Callable[[], None]) -> None:
        self._sessions_dir = sessions_dir
        self._on_read = on_read

    def list(self) -> list[Session]:
        self._on_read()
        sessions = [_read_model_file(path, Session) for path in self._iter_session_paths()]
        return sorted(sessions, key=lambda session: session.updated_at, reverse=True)

    def get(self, session_id: str) -> Session | None:
        session_path = self._sessions_dir / f"{session_id}.json"
        if not session_path.exists():
            return None
        self._on_read()
        return _read_model_file(session_path, Session)

    def latest_open(self) -> Session | None:
        for session in self.list():
            if session.status in ("draft", "open"):
                return session
        return None

    def create(self, session: Session) -> Session:
        self._on_read()
        _write_json_file(
            self._sessions_dir / f"{session.id}.json",
            session.model_dump(mode="json"),
        )
        return session

    def update(self, session_id: str, updated_session: Session) -> Session:
        self._on_read()
        _write_json_file(
            self._sessions_dir / f"{session_id}.json",
            updated_session.model_dump(mode="json"),
        )
        return updated_session

    def _iter_session_paths(self) -> list[Path]:
        return sorted(
            (path for path in self._sessions_dir.glob("*.json") if path.is_file()),
            key=lambda path: path.name,
        )


def create_app() -> FastAPI:
    project_registry = ProjectRegistry(PROJECTS_FILE, ensure_storage)
    prompt_library = PromptLibraryStore(LIBRARY_DIR, ensure_storage)
    session_store = SessionStore(SESSIONS_DIR, ensure_storage)
    app = FastAPI(title="Prompt OS API", version="0.2.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3005",
            "http://127.0.0.1:3005",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
        allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    async def startup() -> None:
        ensure_storage()

    @app.post("/api/clarify", response_model=ClarifyResponse)
    async def clarify_intent(payload: ClarifyRequest) -> ClarifyResponse:
        repo_map = _load_repo_map(project_registry, payload.project_id)
        try:
            return generate_clarifying_questions(
                task_type=payload.task_type,
                rough_intent=payload.rough_intent,
                repo_map_summary=repo_map.summary if repo_map else None,
            )
        except RuntimeError as exc:
            raise _to_ai_http_exception(exc) from exc

    @app.post("/api/compile", response_model=CompileResponse)
    async def compile_prompt(payload: CompileRequest) -> CompileResponse:
        repo_map = _load_repo_map(project_registry, payload.project_id)
        try:
            return generate_compiled_prompt(
                task_type=payload.task_type,
                rough_intent=payload.rough_intent,
                answers=payload.answers,
                target_model=payload.target_model,
                repo_map_summary=repo_map.summary if repo_map else None,
            )
        except RuntimeError as exc:
            raise _to_ai_http_exception(exc) from exc

    @app.post("/api/route", response_model=RouteResponse)
    async def route_prompt(payload: RouteRequest) -> RouteResponse:
        repo_map = _load_repo_map(project_registry, payload.project_id)
        try:
            return recommend_model(
                task_type=payload.task_type,
                rough_intent=payload.rough_intent,
                answers=payload.answers,
                repo_map_summary=repo_map.summary if repo_map else None,
            )
        except RuntimeError as exc:
            raise _to_ai_http_exception(exc) from exc

    @app.get("/api/projects", response_model=list[Project])
    async def list_projects() -> list[Project]:
        return project_registry.list()

    @app.post(
        "/api/projects",
        response_model=Project,
        status_code=status.HTTP_201_CREATED,
    )
    async def create_project(payload: ProjectCreateRequest) -> Project:
        resolved_path = _resolve_directory(payload.path)
        projects = project_registry.list()

        for project in projects:
            if project.name.casefold() == payload.name.casefold():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Project name '{payload.name}' is already registered.",
                )
            if Path(project.path).resolve() == resolved_path:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Project path '{resolved_path.as_posix()}' is already registered.",
                )

        timestamp = _utc_now()
        project = Project(
            id=str(uuid.uuid4()),
            name=payload.name,
            path=resolved_path.as_posix(),
            created_at=timestamp,
            updated_at=timestamp,
        )
        return project_registry.create(project)

    @app.post("/api/projects/{project_id}/map", response_model=ProjectMapResponse)
    async def generate_project_map(project_id: str) -> ProjectMapResponse:
        project = project_registry.get(project_id)
        if project is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project '{project_id}' was not found.",
            )

        repo_map = harvest_project(
            project_id=project.id,
            project_name=project.name,
            project_path=Path(project.path),
            maps_dir=MAPS_DIR,
        )
        mapped_at = _utc_now()
        updated_project = project.model_copy(
            update={
                "repo_map_path": (MAPS_DIR / f"{project.id}.json").as_posix(),
                "last_mapped_at": mapped_at,
                "updated_at": mapped_at,
            }
        )
        project_registry.update(project_id, updated_project)
        return ProjectMapResponse(project=updated_project, repo_map=repo_map)

    @app.get("/api/library", response_model=list[Prompt])
    async def list_library() -> list[Prompt]:
        return prompt_library.list()

    @app.post(
        "/api/library",
        response_model=Prompt,
        status_code=status.HTTP_201_CREATED,
    )
    async def save_prompt_to_library(payload: PromptCreateRequest) -> Prompt:
        if project_registry.get(payload.project_id) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project '{payload.project_id}' was not found.",
            )
        if payload.session_id and session_store.get(payload.session_id) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session '{payload.session_id}' was not found.",
            )

        prompt = Prompt(
            id=str(uuid.uuid4()),
            project_id=payload.project_id,
            task_type=payload.task_type,
            session_id=payload.session_id,
            compiled_version_id=payload.compiled_version_id,
            title=payload.title,
            rough_intent=payload.rough_intent,
            compiled_prompt=payload.compiled_prompt,
            target_model=payload.target_model,
            expected_result_assessment=payload.expected_result_assessment,
            effectiveness_rating=payload.effectiveness_rating,
            created_at=_utc_now(),
        )
        return prompt_library.create(prompt)

    @app.get("/api/sessions", response_model=list[Session])
    async def list_sessions() -> list[Session]:
        return session_store.list()

    @app.get("/api/sessions/latest", response_model=Session | None)
    async def latest_session() -> Session | None:
        return session_store.latest_open()

    @app.get("/api/sessions/{session_id}", response_model=Session)
    async def get_session(session_id: str) -> Session:
        session = session_store.get(session_id)
        if session is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session '{session_id}' was not found.",
            )
        return session

    @app.post(
        "/api/sessions",
        response_model=Session,
        status_code=status.HTTP_201_CREATED,
    )
    async def create_session(payload: SessionCreateRequest) -> Session:
        if payload.project_id and project_registry.get(payload.project_id) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project '{payload.project_id}' was not found.",
            )

        timestamp = _utc_now()
        session = Session(
            id=str(uuid.uuid4()),
            project_id=payload.project_id,
            task_type=payload.task_type,
            title=payload.title or _derive_session_title(payload.rough_intent, payload.task_type),
            rough_intent=payload.rough_intent,
            status=payload.status,
            created_at=timestamp,
            updated_at=timestamp,
        )
        return session_store.create(session)

    @app.put("/api/sessions/{session_id}", response_model=Session)
    async def update_session(session_id: str, payload: SessionUpdateRequest) -> Session:
        existing_session = session_store.get(session_id)
        if existing_session is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session '{session_id}' was not found.",
            )
        if payload.project_id and project_registry.get(payload.project_id) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project '{payload.project_id}' was not found.",
            )

        clarify_rounds = list(existing_session.clarify_rounds)
        if payload.append_clarify_round is not None:
            clarify_rounds.append(payload.append_clarify_round)

        compiled_versions = list(existing_session.compiled_versions)
        if payload.append_compiled_version is not None:
            compiled_versions.append(payload.append_compiled_version)

        updated_session = existing_session.model_copy(
            update={
                "project_id": payload.project_id
                if "project_id" in payload.model_fields_set
                else existing_session.project_id,
                "task_type": payload.task_type
                if "task_type" in payload.model_fields_set
                else existing_session.task_type,
                "title": payload.title
                if "title" in payload.model_fields_set
                else existing_session.title,
                "rough_intent": payload.rough_intent
                if "rough_intent" in payload.model_fields_set
                else existing_session.rough_intent,
                "reformulated_intent": payload.reformulated_intent
                if "reformulated_intent" in payload.model_fields_set
                else existing_session.reformulated_intent,
                "selected_model": payload.selected_model
                if "selected_model" in payload.model_fields_set
                else existing_session.selected_model,
                "clarify_rounds": clarify_rounds,
                "route_result": payload.route_result
                if "route_result" in payload.model_fields_set
                else existing_session.route_result,
                "compiled_versions": compiled_versions,
                "status": payload.status
                if "status" in payload.model_fields_set
                else existing_session.status,
                "updated_at": _utc_now(),
            }
        )
        return session_store.update(session_id, updated_session)

    return app


def ensure_storage() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    MAPS_DIR.mkdir(parents=True, exist_ok=True)
    LIBRARY_DIR.mkdir(parents=True, exist_ok=True)
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
    if not PROJECTS_FILE.exists():
        PROJECTS_FILE.write_text("[]\n", encoding="utf-8")


def _read_model_file(path: Path, model_type: type[Project] | type[Prompt] | type[Session] | type[RepoMap]):
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except JSONDecodeError as exc:
        raise RuntimeError(f"JSON file is invalid: {path.as_posix()}") from exc

    try:
        return model_type.model_validate(payload)
    except ValidationError as exc:
        raise RuntimeError(f"JSON file has invalid data: {path.as_posix()}") from exc


def _write_json_file(path: Path, payload: dict[str, object]) -> None:
    temp_path = path.with_name(f"{path.name}.tmp")
    temp_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    temp_path.replace(path)


def _derive_session_title(rough_intent: str | None, task_type: str | None) -> str:
    if rough_intent:
        compact = " ".join(rough_intent.strip().split())
        return compact[:160]
    if task_type:
        return f"{task_type.replace('_', ' ').title()} session"
    return "Untitled session"


def _resolve_directory(raw_path: str) -> Path:
    candidate = Path(raw_path).expanduser().resolve()
    if not candidate.exists():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Project path '{candidate.as_posix()}' does not exist.",
        )
    if not candidate.is_dir():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Project path '{candidate.as_posix()}' is not a directory.",
        )
    return candidate


def _load_repo_map(
    project_registry: ProjectRegistry,
    project_id: str | None,
) -> RepoMap | None:
    if not project_id:
        return None

    project = project_registry.get(project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' was not found.",
        )
    if not project.repo_map_path:
        return None

    repo_map_path = Path(project.repo_map_path)
    if not repo_map_path.is_absolute():
        repo_map_path = PROJECT_ROOT / repo_map_path
    if not repo_map_path.exists():
        return None

    try:
        payload = json.loads(repo_map_path.read_text(encoding="utf-8"))
    except JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Repo map '{repo_map_path.as_posix()}' is not valid JSON.",
        ) from exc

    try:
        return RepoMap.model_validate(payload)
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Repo map '{repo_map_path.as_posix()}' is invalid.",
        ) from exc


def _to_ai_http_exception(exc: RuntimeError) -> HTTPException:
    message = str(exc)
    status_code = (
        status.HTTP_503_SERVICE_UNAVAILABLE
        if "OPENAI_API_KEY" in message
        else status.HTTP_502_BAD_GATEWAY
    )
    return HTTPException(status_code=status_code, detail=message)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


app = create_app()
