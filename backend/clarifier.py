from __future__ import annotations

from pydantic import BaseModel, Field

try:
    from backend.models import ClarifyResponse, ClarifyingQuestion, TaskType
    from backend.openai_client import get_client
    from backend.prompts.clarifier_system import (
        CLARIFIER_SYSTEM_PROMPT,
        get_task_clarifier_guidance,
    )
except ModuleNotFoundError:
    from models import ClarifyResponse, ClarifyingQuestion, TaskType
    from openai_client import get_client
    from prompts.clarifier_system import (
        CLARIFIER_SYSTEM_PROMPT,
        get_task_clarifier_guidance,
    )

CLARIFIER_MODEL = "gpt-5.4"


class _ClarifierPayload(BaseModel):
    questions: list[ClarifyingQuestion] = Field(min_length=3, max_length=8)


def generate_clarifying_questions(
    task_type: TaskType,
    rough_intent: str,
    repo_map_summary: str | None = None,
) -> ClarifyResponse:
    client = get_client()
    try:
        response = client.responses.parse(
            model=CLARIFIER_MODEL,
            instructions=CLARIFIER_SYSTEM_PROMPT,
            input=_build_clarifier_prompt(task_type, rough_intent, repo_map_summary),
            text_format=_ClarifierPayload,
            text={"verbosity": "low"},
            reasoning={"effort": "medium"},
            max_output_tokens=1600,
        )
    except Exception as exc:
        raise RuntimeError(f"OpenAI clarify request failed: {exc}") from exc

    parsed = getattr(response, "output_parsed", None)
    if not parsed:
        raise RuntimeError("The clarifier returned no structured output.")

    return ClarifyResponse(
        task_type=task_type,
        questions=parsed.questions,
        project_context_used=bool(repo_map_summary),
    )


def _build_clarifier_prompt(
    task_type: TaskType,
    rough_intent: str,
    repo_map_summary: str | None,
) -> str:
    project_context = repo_map_summary.strip() if repo_map_summary else "No repo map is available."
    return "\n".join(
        [
            "Generate clarifying questions for this rough software intent.",
            "",
            "Selected task type:",
            task_type,
            "",
            "Task-specific guidance:",
            get_task_clarifier_guidance(task_type),
            "",
            "Question design requirements:",
            "- Return 3 to 8 questions.",
            "- Prefer single_choice or multi_choice questions whenever concrete options are possible.",
            "- Use free_text only when nuance is essential.",
            "- Prioritize the kind of issue, where it lives, expected vs current behavior, scope, severity, and concrete examples.",
            "- Use repo context only to anchor likely areas of the system. Do not assume the root cause.",
            "",
            "Rough intent:",
            rough_intent.strip(),
            "",
            "Repo map summary:",
            project_context,
        ]
    )
