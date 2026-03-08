from __future__ import annotations

from pydantic import BaseModel, Field

try:
    from backend.models import ReformulateResponse, TaskType
    from backend.openai_client import get_client
    from backend.prompts.reformulator_system import REFORMULATOR_SYSTEM_PROMPT
except ModuleNotFoundError:
    from models import ReformulateResponse, TaskType
    from openai_client import get_client
    from prompts.reformulator_system import REFORMULATOR_SYSTEM_PROMPT

REFORMULATOR_MODEL = "gpt-5.4"


class _ReformulatorPayload(BaseModel):
    reformulated_intent: str = Field(description="The reformulated intent text")


def reformulate(
    task_type: TaskType,
    rough_intent: str,
    repo_map_summary: str | None = None,
) -> ReformulateResponse:
    client = get_client()
    try:
        response = client.responses.parse(
            model=REFORMULATOR_MODEL,
            instructions=REFORMULATOR_SYSTEM_PROMPT,
            input=_build_reformulator_prompt(task_type, rough_intent, repo_map_summary),
            text_format=_ReformulatorPayload,
            reasoning={"effort": "low"},
            max_output_tokens=800,
        )
    except Exception as exc:
        raise RuntimeError(f"OpenAI reformulate request failed: {exc}") from exc

    parsed = getattr(response, "output_parsed", None)
    if not parsed:
        raise RuntimeError("The reformulator returned no structured output.")

    return ReformulateResponse(
        original_intent=rough_intent,
        reformulated_intent=parsed.reformulated_intent,
    )


def _build_reformulator_prompt(
    task_type: TaskType,
    rough_intent: str,
    repo_map_summary: str | None,
) -> str:
    project_context = repo_map_summary.strip() if repo_map_summary else "No repo map is available."
    return "\n".join(
        [
            "Reformulate this rough software intent into clear, structured prose.",
            "",
            "Task type:",
            task_type,
            "",
            "Rough intent:",
            rough_intent.strip(),
            "",
            "Repo map summary (for context only — do not introduce new requirements from it):",
            project_context,
        ]
    )
