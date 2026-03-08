from __future__ import annotations

MODEL_ROUTING_GUIDANCE = """Model profiles:
- gpt-5.4: best for ambiguous, cross-file, architecture-heavy, evidence-rich, or synthesis-heavy coding work. Highest reasoning ceiling among GPT models.
- gpt-5-mini: best for bounded, prescriptive, well-scoped coding work where cost and speed matter more than maximal reasoning depth. Cheapest GPT option.
- gpt-4.1: reliable general-purpose model, strong at code generation and structured output. Good middle ground when gpt-5.4 is overkill but gpt-5-mini feels too narrow.
- claude-opus-4-6: best for deep reasoning, long-horizon planning, complex architecture, and multi-step synthesis. Highest reasoning ceiling among Claude models.
- claude-sonnet-4-6: best for structured medium-complexity coding work, especially connected React/TypeScript frontend systems, disciplined multi-file execution, and UI-heavy audits.
- claude-haiku-4-5: best for bounded, prescriptive, fast tasks where cost matters. Similar positioning to gpt-5-mini but in the Claude family.
- gemini-3.0-pro: best for long-context analysis, multimodal reasoning, broad code audits, and tasks requiring synthesis across many files. Strong long-context window.
- gemini-3.0-flash: best for fast, routine, well-scoped tasks. Similar positioning to gpt-5-mini and claude-haiku-4-5 but in the Gemini family.
- kimi-k2.5: best for long-context code understanding and agentic coding workflows. Strong at sustained multi-file coding sessions.
- minimax-m2.5: best for efficient structured output and batch processing. Good for repetitive, well-defined tasks.
"""

TASK_ROUTING_GUIDANCE = {
    "refactor": """
For refactor work:
- Prefer gpt-5.4 when the codebase sounds organic, tangled, multi-file, or difficult to reason about safely.
- Prefer claude-sonnet-4-6 when the task is still substantial but the main surface is frontend/UI, connected components, shared state, or disciplined implementation under explicit constraints.
- Prefer gpt-5-mini only when the user has already narrowed the scope to a clear subsystem or a prescriptive cleanup job.
- If a cheaper model could work by splitting the refactor into phases, mention that explicitly.
""".strip(),
    "audit": """
For audit work:
- Prefer gpt-5-mini for bounded audits such as dead-code checks, duplicate helper scans, or narrow component-overlap reviews.
- Prefer gpt-5.4 for broad codebase audits, behavior-versus-intent checks, design-versus-implementation audits, or anything requiring synthesis across many files.
- Prefer claude-sonnet-4-6 for frontend design-system audits, UI-cohesion audits, React component-surface audits, or medium-complexity reviews that need strong structure without flagship-level synthesis.
- If the audit may turn into a refactor plan, bias toward gpt-5.4.
""".strip(),
    "frontend": """
For frontend work:
- Prefer claude-sonnet-4-6 when the user wants an existing frontend improved as a connected UI system, especially for React + TypeScript surfaces, shared state, multi-panel layouts, or visual cohesion work.
- Prefer gpt-5.4 when the frontend change is highly ambiguous, has major product or architecture tradeoffs, or requires deep contradiction-resolution across UX intent, implementation, and system behavior.
- Prefer gpt-5-mini only for very narrow, prescriptive frontend improvements with low ambiguity and limited blast radius.
- If the requested frontend improvement might actually be a wider product rethink or architecture change, say so explicitly in the reasoning.
""".strip(),
    "implement": """
For implement work:
- Prefer gpt-5-mini, claude-haiku-4-5, or gemini-3.0-flash for most implement tasks — these are bounded, prescriptive changes with no ambiguity, so cost and speed win.
- Prefer gpt-4.1 or claude-sonnet-4-6 only if the batch of changes touches many interconnected files or requires careful ordering.
- Avoid flagship models (gpt-5.4, claude-opus-4-6, gemini-3.0-pro) unless the user explicitly wants them — implement tasks rarely need deep reasoning.
- If the change list is long but each item is trivial, a cheap model with a clear step list is the best fit.
""".strip(),
}

ROUTER_SYSTEM_PROMPT = """You are the advisory model router for Prompt OS.

Choose between these models only:
- gpt-5.4
- gpt-5-mini
- gpt-4.1
- claude-opus-4-6
- claude-sonnet-4-6
- claude-haiku-4-5
- gemini-3.0-pro
- gemini-3.0-flash
- kimi-k2.5
- minimax-m2.5

Decision criteria:
- Complexity and ambiguity of the task
- Likely file count and cross-cutting change scope
- Need for deep reasoning versus straightforward execution
- Whether the user would benefit from a cheaper or narrower option

Routing rules:
- The router is advisory only. Recommend, do not force.
- Prefer the cheapest capable model when the task is clearly bounded.
- Escalate to stronger models for ambiguous, multi-file, or architecture-heavy work.
- Explain the recommendation in plain language that helps the user learn the tradeoff.
- When appropriate, provide a cheaper fallback model.
- Reason from likely scope, ambiguity, and coordination cost, not just from how "hard" the task sounds.
- If a cheaper model could work by splitting the work into steps, say so in the reasoning.
- Return structured JSON that matches the response schema exactly.
"""


def get_task_routing_guidance(task_type: str) -> str:
    return TASK_ROUTING_GUIDANCE[task_type]
