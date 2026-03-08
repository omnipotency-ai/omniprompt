from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

ModelChoice = Literal[
    "gpt-5.4",
    "gpt-5-mini",
    "gpt-4.1",
    "claude-opus-4-6",
    "claude-sonnet-4-6",
    "claude-haiku-4-5",
    "gemini-3.0-flash",
    "gemini-3.0-pro",
    "kimi-k2.5",
    "minimax-m2.5",
]

TaskType = Literal["refactor", "frontend", "audit", "implement"]

SessionStatus = Literal["draft", "open", "closed"]
ComplexityLevel = Literal["low", "medium", "high"]
QuestionInputType = Literal["single_choice", "multi_choice", "free_text"]


class ApiModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


# ---------------------------------------------------------------------------
# Project
# ---------------------------------------------------------------------------


class ProjectCreateRequest(ApiModel):
    name: str = Field(min_length=1, max_length=120)
    path: str = Field(min_length=1)

    @field_validator("name", "path")
    @classmethod
    def validate_non_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("value must not be blank")
        return stripped


class Project(ApiModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1, max_length=120)
    path: str = Field(min_length=1)
    repo_map_path: str | None = None
    created_at: datetime
    updated_at: datetime
    last_mapped_at: datetime | None = None


# ---------------------------------------------------------------------------
# Repo map
# ---------------------------------------------------------------------------


class RepoMapFile(ApiModel):
    path: str = Field(min_length=1)
    extension: str | None = None
    language: str | None = None
    size_bytes: int = Field(ge=0)
    exports: list[str] = Field(default_factory=list)


class RepoMap(ApiModel):
    project_id: str = Field(min_length=1)
    project_name: str = Field(min_length=1)
    project_path: str = Field(min_length=1)
    generated_at: datetime
    file_count: int = Field(ge=0)
    tree_lines: list[str] = Field(default_factory=list)
    files: list[RepoMapFile] = Field(default_factory=list)
    summary: str = Field(min_length=1)


class ProjectMapResponse(ApiModel):
    project: Project
    repo_map: RepoMap


# ---------------------------------------------------------------------------
# Clarifying questions and answers
# ---------------------------------------------------------------------------


class ClarifyingOption(ApiModel):
    label: str = Field(min_length=1, max_length=160)
    value: str = Field(min_length=1, max_length=160)


class ClarifyingQuestion(ApiModel):
    id: str = Field(min_length=1, max_length=64)
    question: str = Field(min_length=1, max_length=400)
    input_type: QuestionInputType
    options: list[ClarifyingOption] = Field(default_factory=list, max_length=6)
    placeholder: str | None = Field(default=None, max_length=200)

    @model_validator(mode="after")
    def validate_options(self) -> "ClarifyingQuestion":
        if self.input_type == "free_text" and self.options:
            raise ValueError("free_text questions cannot include options")
        if self.input_type != "free_text" and len(self.options) < 2:
            raise ValueError("choice questions must include at least two options")
        return self


class ClarifyingAnswer(ApiModel):
    question_id: str = Field(min_length=1, max_length=64)
    question: str | None = Field(default=None, min_length=1, max_length=400)
    answer: str = Field(min_length=1, max_length=1000)


class ClarifyRound(ApiModel):
    """A single round of clarifying Q&A. Sessions accumulate multiple rounds."""

    id: str = Field(min_length=1)
    round_number: int = Field(ge=1)
    questions: list[ClarifyingQuestion] = Field(default_factory=list)
    answers: list[ClarifyingAnswer] = Field(default_factory=list)
    created_at: datetime


# ---------------------------------------------------------------------------
# Compiled prompt versions
# ---------------------------------------------------------------------------


class CompiledVersion(ApiModel):
    """One compiled prompt output. Sessions accumulate multiple versions."""

    id: str = Field(min_length=1)
    version_label: str = Field(min_length=1, max_length=16)  # "1", "1.01", "2"
    compiled_prompt: str = Field(min_length=1)
    target_model: ModelChoice
    project_context_used: bool
    created_at: datetime


# ---------------------------------------------------------------------------
# Session
# ---------------------------------------------------------------------------


class Session(ApiModel):
    id: str = Field(min_length=1)
    project_id: str | None = None
    task_type: TaskType | None = None
    title: str | None = Field(default=None, min_length=1, max_length=160)
    rough_intent: str | None = None
    reformulated_intent: str | None = None
    selected_model: ModelChoice | None = None
    clarify_rounds: list[ClarifyRound] = Field(default_factory=list)
    route_result: "RouteResponse | None" = None
    compiled_versions: list[CompiledVersion] = Field(default_factory=list)
    status: SessionStatus = "draft"
    created_at: datetime
    updated_at: datetime


class SessionCreateRequest(ApiModel):
    project_id: str | None = Field(default=None, min_length=1)
    task_type: TaskType | None = None
    title: str | None = Field(default=None, min_length=1, max_length=160)
    rough_intent: str | None = Field(default=None, min_length=1)
    status: SessionStatus = "draft"


class SessionUpdateRequest(ApiModel):
    project_id: str | None = Field(default=None, min_length=1)
    task_type: TaskType | None = None
    title: str | None = Field(default=None, min_length=1, max_length=160)
    rough_intent: str | None = Field(default=None, min_length=1)
    reformulated_intent: str | None = Field(default=None, min_length=1)
    selected_model: ModelChoice | None = None
    append_clarify_round: "ClarifyRound | None" = None
    route_result: "RouteResponse | None" = None
    append_compiled_version: "CompiledVersion | None" = None
    status: SessionStatus | None = None

    @model_validator(mode="after")
    def validate_has_update(self) -> "SessionUpdateRequest":
        if all(
            value is None
            for value in (
                self.project_id,
                self.task_type,
                self.title,
                self.rough_intent,
                self.reformulated_intent,
                self.selected_model,
                self.append_clarify_round,
                self.route_result,
                self.append_compiled_version,
                self.status,
            )
        ):
            raise ValueError("session update must include at least one change")
        return self


# ---------------------------------------------------------------------------
# Library prompt
# ---------------------------------------------------------------------------


class Prompt(ApiModel):
    id: str = Field(min_length=1)
    project_id: str = Field(min_length=1)
    task_type: TaskType
    session_id: str | None = None
    compiled_version_id: str | None = None
    title: str | None = Field(default=None, min_length=1, max_length=160)
    rough_intent: str = Field(min_length=1)
    compiled_prompt: str = Field(min_length=1)
    target_model: ModelChoice
    expected_result_assessment: str | None = None
    effectiveness_rating: int | None = Field(default=None, ge=1, le=7)
    created_at: datetime


class PromptCreateRequest(ApiModel):
    project_id: str = Field(min_length=1)
    task_type: TaskType
    session_id: str | None = Field(default=None, min_length=1)
    compiled_version_id: str | None = Field(default=None, min_length=1)
    title: str | None = Field(default=None, min_length=1, max_length=160)
    rough_intent: str = Field(min_length=1)
    compiled_prompt: str = Field(min_length=1)
    target_model: ModelChoice
    expected_result_assessment: str | None = Field(default=None, min_length=1, max_length=4000)
    effectiveness_rating: int | None = Field(default=None, ge=1, le=7)


# ---------------------------------------------------------------------------
# AI request/response models
# ---------------------------------------------------------------------------


class ClarifyRequest(ApiModel):
    project_id: str | None = Field(default=None, min_length=1)
    task_type: TaskType
    rough_intent: str = Field(min_length=1)


class ClarifyResponse(ApiModel):
    task_type: TaskType
    questions: list[ClarifyingQuestion] = Field(min_length=3, max_length=8)
    project_context_used: bool


class RouteRequest(ApiModel):
    project_id: str | None = Field(default=None, min_length=1)
    task_type: TaskType
    rough_intent: str = Field(min_length=1)
    answers: list[ClarifyingAnswer] = Field(default_factory=list)


class RouteResponse(ApiModel):
    task_type: TaskType
    recommended_model: ModelChoice
    estimated_complexity: ComplexityLevel
    reasoning: str = Field(min_length=1, max_length=1000)
    budget_alternative: ModelChoice | None = None
    advisory_only: bool = True


class CompileRequest(ApiModel):
    project_id: str | None = Field(default=None, min_length=1)
    task_type: TaskType
    rough_intent: str = Field(min_length=1)
    answers: list[ClarifyingAnswer] = Field(default_factory=list)
    target_model: ModelChoice


class CompileResponse(ApiModel):
    task_type: TaskType
    target_model: ModelChoice
    compiled_prompt: str = Field(min_length=1)
    project_context_used: bool


class ReformulateRequest(ApiModel):
    task_type: TaskType
    rough_intent: str = Field(min_length=1)
    project_id: str | None = None


class ReformulateResponse(ApiModel):
    original_intent: str
    reformulated_intent: str


Session.model_rebuild()
SessionCreateRequest.model_rebuild()
SessionUpdateRequest.model_rebuild()
