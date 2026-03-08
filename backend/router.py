from __future__ import annotations

import os

from openai import OpenAI
from pydantic import BaseModel, Field

try:
    from backend.models import (
        ClarifyingAnswer,
        ComplexityLevel,
        ModelChoice,
        RouteResponse,
        TaskType,
    )
    from backend.prompts.router_system import (
        MODEL_ROUTING_GUIDANCE,
        ROUTER_SYSTEM_PROMPT,
        get_task_routing_guidance,
    )
except ModuleNotFoundError:
    from models import (
        ClarifyingAnswer,
        ComplexityLevel,
        ModelChoice,
        RouteResponse,
        TaskType,
    )
    from prompts.router_system import (
        MODEL_ROUTING_GUIDANCE,
        ROUTER_SYSTEM_PROMPT,
        get_task_routing_guidance,
    )

ROUTER_MODEL = "gpt-5-mini"


class _RouterPayload(BaseModel):
    recommended_model: ModelChoice
    estimated_complexity: ComplexityLevel
    reasoning: str = Field(min_length=1, max_length=1000)
    budget_alternative: ModelChoice | None = None


def recommend_model(
    task_type: TaskType,
    rough_intent: str,
    answers: list[ClarifyingAnswer],
    repo_map_summary: str | None = None,
) -> RouteResponse:
    client = _build_client()
    try:
        response = client.responses.parse(
            model=ROUTER_MODEL,
            instructions=ROUTER_SYSTEM_PROMPT,
            input=_build_router_prompt(task_type, rough_intent, answers, repo_map_summary),
            text_format=_RouterPayload,
            text={"verbosity": "low"},
            reasoning={"effort": "low"},
            max_output_tokens=1000,
        )
    except Exception as exc:
        raise RuntimeError(f"OpenAI route request failed: {exc}") from exc

    parsed = getattr(response, "output_parsed", None)
    if not parsed:
        raise RuntimeError("The router returned no structured output.")

    return RouteResponse(
        task_type=task_type,
        recommended_model=parsed.recommended_model,
        estimated_complexity=parsed.estimated_complexity,
        reasoning=parsed.reasoning,
        budget_alternative=parsed.budget_alternative,
        advisory_only=True,
    )


def _build_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured.")
    return OpenAI(api_key=api_key)


def _build_router_prompt(
    task_type: TaskType,
    rough_intent: str,
    answers: list[ClarifyingAnswer],
    repo_map_summary: str | None,
) -> str:
    return "\n".join(
        [
            "Recommend the best model for this software task.",
            "",
            "Selected task type:",
            task_type,
            "",
            MODEL_ROUTING_GUIDANCE.strip(),
            "",
            "Task-specific routing guidance:",
            get_task_routing_guidance(task_type),
            "",
            "Rough intent:",
            rough_intent.strip(),
            "",
            "Clarifying answers:",
            _render_answers(answers),
            "",
            "Repo map summary:",
            repo_map_summary.strip() if repo_map_summary else "No repo map is available.",
            "",
            "Output requirements:",
            "- Choose one recommended_model from the allowed list.",
            "- Set estimated_complexity to low, medium, or high.",
            "- Explain the tradeoff in plain language.",
            "- Include budget_alternative only when a cheaper model is plausibly capable.",
        ]
    )


def _render_answers(answers: list[ClarifyingAnswer]) -> str:
    if not answers:
        return "- No clarifying answers were provided."
    return "\n".join(
        f"- {answer.question or answer.question_id}: {answer.answer.strip()}"
        for answer in answers
    )
