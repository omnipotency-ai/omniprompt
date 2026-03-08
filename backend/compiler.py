from __future__ import annotations

import os

from openai import OpenAI

try:
    from backend.models import ClarifyingAnswer, CompileResponse, ModelChoice, TaskType
    from backend.openai_client import get_client
    from backend.prompts.compiler_system import (
        COMPILER_SYSTEM_PROMPT,
        get_model_compilation_guidance,
        get_model_output_blueprint,
        get_task_compilation_guidance,
    )
except ModuleNotFoundError:
    from models import ClarifyingAnswer, CompileResponse, ModelChoice, TaskType
    from openai_client import get_client
    from prompts.compiler_system import (
        COMPILER_SYSTEM_PROMPT,
        get_model_compilation_guidance,
        get_model_output_blueprint,
        get_task_compilation_guidance,
    )

def _read_int_env(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default

    try:
        value = int(raw_value)
    except ValueError:
        return default

    return value if value > 0 else default


COMPILER_MODEL = "gpt-5.4"
INITIAL_COMPILE_MAX_OUTPUT_TOKENS = _read_int_env(
    "PROMPT_OS_INITIAL_COMPILE_MAX_OUTPUT_TOKENS",
    7000,
)
RETRY_COMPILE_MAX_OUTPUT_TOKENS = _read_int_env(
    "PROMPT_OS_RETRY_COMPILE_MAX_OUTPUT_TOKENS",
    12000,
)


def generate_compiled_prompt(
    task_type: TaskType,
    rough_intent: str,
    answers: list[ClarifyingAnswer],
    target_model: ModelChoice,
    repo_map_summary: str | None = None,
) -> CompileResponse:
    client = get_client()
    try:
        compiler_input = _build_compiler_prompt(
            task_type=task_type,
            rough_intent=rough_intent,
            answers=answers,
            target_model=target_model,
            repo_map_summary=repo_map_summary,
        )
        response = _request_compiled_prompt(
            client=client,
            compiler_input=compiler_input,
            task_type=task_type,
            target_model=target_model,
            max_output_tokens=INITIAL_COMPILE_MAX_OUTPUT_TOKENS,
        )

        if _response_hit_output_limit(response):
            response = _request_compiled_prompt(
                client=client,
                compiler_input=compiler_input,
                task_type=task_type,
                target_model=target_model,
                max_output_tokens=RETRY_COMPILE_MAX_OUTPUT_TOKENS,
            )
    except Exception as exc:
        raise RuntimeError(f"OpenAI compile request failed: {exc}") from exc

    if _response_hit_output_limit(response):
        raise RuntimeError(
            "The compiler output hit the Responses API max_output_tokens limit before finishing. Narrow the task or increase the compile token budget."
        )

    compiled_prompt = _normalize_compiled_prompt(response.output_text)
    if not compiled_prompt:
        raise RuntimeError("The compiler returned an empty prompt.")

    return CompileResponse(
        task_type=task_type,
        target_model=target_model,
        compiled_prompt=compiled_prompt,
        project_context_used=bool(repo_map_summary),
    )


def _request_compiled_prompt(
    client: OpenAI,
    compiler_input: str,
    task_type: TaskType,
    target_model: ModelChoice,
    max_output_tokens: int,
):
    return client.responses.create(
        model=COMPILER_MODEL,
        instructions=COMPILER_SYSTEM_PROMPT,
        input=compiler_input,
        reasoning={"effort": _compiler_reasoning_effort(task_type, target_model)},
        max_output_tokens=max_output_tokens,
    )


def _build_compiler_prompt(
    task_type: TaskType,
    rough_intent: str,
    answers: list[ClarifyingAnswer],
    target_model: ModelChoice,
    repo_map_summary: str | None,
) -> str:
    return "\n".join(
        [
            "Compile one prompt for the target model below.",
            "",
            "Selected task type:",
            task_type,
            "",
            f"Target model: {target_model}",
            "",
            "Task-specific guidance:",
            get_task_compilation_guidance(task_type),
            "",
            "Target model guidance:",
            get_model_compilation_guidance(target_model),
            "",
            "Required final prompt shape:",
            get_model_output_blueprint(target_model, task_type),
            "",
            "Compiler requirements:",
            "- Preserve unresolved uncertainty honestly instead of pretending details are known.",
            "- Include safety constraints for destructive actions, risky migrations, and unverifiable assumptions.",
            "- Keep repo context selective and relevant to the user's intent.",
            "- Make the downstream task easy to act on with clear deliverables and verification expectations.",
            "- Tailor the prompt to the selected target model's strengths, structure preferences, and likely execution environment.",
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
            "Output requirement:",
            "Return one final prompt that is ready to paste into the target model.",
        ]
    )


def _compiler_reasoning_effort(task_type: TaskType, target_model: ModelChoice) -> str:
    if task_type == "refactor" or target_model in {"gpt-5.4", "claude-sonnet-4-6"}:
        return "medium"
    return "low"


def _normalize_compiled_prompt(output_text: str) -> str:
    stripped = output_text.strip()
    if not stripped.startswith("```") or not stripped.endswith("```"):
        return stripped

    lines = stripped.splitlines()
    if len(lines) < 3:
        return ""
    return "\n".join(lines[1:-1]).strip()


def _response_hit_output_limit(response: object) -> bool:
    status = getattr(response, "status", None)
    if status != "incomplete":
        return False

    incomplete_details = getattr(response, "incomplete_details", None)
    if incomplete_details is None:
        return False

    reason = getattr(incomplete_details, "reason", None)
    if reason is None and isinstance(incomplete_details, dict):
        reason = incomplete_details.get("reason")

    return reason == "max_output_tokens"


def _render_answers(answers: list[ClarifyingAnswer]) -> str:
    if not answers:
        return "- No clarifying answers were provided. Keep remaining ambiguity explicit in the compiled prompt."
    return "\n".join(
        f"- {answer.question or answer.question_id}: {answer.answer.strip()}"
        for answer in answers
    )
