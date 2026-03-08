from __future__ import annotations

from functools import lru_cache
from pathlib import Path

MODEL_COMPILATION_GUIDANCE = {
    "gpt-5.4": """
- Use explicit XML-style sections because GPT-5.4 follows block-structured instructions well.
- Include the core GPT-5.4 control blocks directly in the final prompt: <reasoning_effort>, <output_contract>, <verbosity_controls>, <default_follow_through_policy>, <instruction_priority>, <tool_persistence_rules>, <dependency_checks>, <parallel_tool_calling>, <completeness_contract>, <empty_result_recovery>, <verification_loop>, and <missing_context_gating>.
- For coding workflows, also include <autonomy_and_persistence>, <user_updates_spec>, and <terminal_tool_hygiene>.
- Add specialized blocks only when the task calls for them, such as <action_safety>, <grounding_rules>, <research_mode>, <structured_output_contract>, <frontend_tasks>, or <task_update>.
- Keep outputs compact and structured. Prefer concise, information-dense instructions over long prose.
- Define what "done" means and how to behave when a dependency, prerequisite, or verification step fails.
- Make tool boundaries explicit for coding workflows: inspect first, verify before destructive changes, and do not guess missing context.
- Choose reasoning effort by task shape, not by defaulting to maximum effort.
- Do not pretend the prompt itself can set Responses API-only runtime fields such as phase or previous_response_id. Mention those only if the user explicitly asks for API integration notes.
""".strip(),
    "gpt-5-mini": """
- Keep the prompt narrower, more prescriptive, and more sequential than for GPT-5.4.
- Prefer explicit scope limits, fixed step order, and short stop conditions.
- Ask for compact execution with strong instruction following rather than broad exploration.
- Use verification, but keep it lightweight and concrete.
- Mini is best when the task is already well-scoped, prescriptive, and low-risk.
""".strip(),
    "claude-sonnet-4-6": """
- Use clear XML sections because Claude follows well-structured prompts especially well.
- Be explicit about scope, non-goals, constraints, and the exact artifact to return.
- For coding work, prefer sequential execution rules, explicit prerequisite checks, and concise verification steps.
- Sonnet 4.6 is especially strong for React + TypeScript frontend systems when the prompt frames the work as one connected UI surface rather than isolated files.
- Ask it to surface tradeoffs, dead-code fallout, and behavior risks explicitly when the task touches multiple connected parts.
- Keep the prompt constraint-forward: do not add extra features, do not widen scope silently, and preserve existing behavior unless told otherwise.
- Use optional frontend-specific guidance only when the task actually touches the UI.
- Do not require exposed chain-of-thought unless the user explicitly wants a visible thinking section.
""".strip(),
    "claude-opus-4-6": """
- Use clear XML sections; Opus follows well-structured prompts especially well.
- Opus excels at deep reasoning, long-horizon planning, and complex architecture work.
- Prefer Opus when the task requires sustained multi-step reasoning across many files, architectural synthesis, or resolving deep contradictions.
- Be explicit about scope, non-goals, constraints, and the exact artifact to return.
- For coding work, prefer sequential execution rules, explicit prerequisite checks, and thorough verification steps.
- Encourage the model to surface architectural tradeoffs, second-order effects, and long-term maintainability concerns.
- Keep the prompt constraint-forward: do not add extra features, do not widen scope silently, and preserve existing behavior unless told otherwise.
- Do not require exposed chain-of-thought unless the user explicitly wants a visible thinking section.
""".strip(),
    "claude-haiku-4-5": """
- Keep the prompt narrower, more prescriptive, and more sequential than for Sonnet or Opus.
- Prefer explicit scope limits, fixed step order, and short stop conditions.
- Ask for compact execution with strong instruction following rather than broad exploration.
- Use verification, but keep it lightweight and concrete.
- Haiku is best when the task is already well-scoped, prescriptive, and low-risk.
""".strip(),
    "gpt-4.1": """
- GPT-4.1 is a reliable general-purpose model with strong code generation and structured output.
- Use explicit XML-style sections; GPT-4.1 follows block-structured instructions well.
- Keep outputs compact and structured. Prefer concise, information-dense instructions over long prose.
- Define what "done" means and how to behave when a dependency or verification step fails.
- For coding workflows, make tool boundaries explicit: inspect first, verify before destructive changes.
- Good for structured output tasks, code generation, and medium-complexity coding work.
""".strip(),
    "gemini-3.0-pro": """
- Gemini Pro excels at long-context analysis, multimodal reasoning, and deep code analysis.
- Use clear section structure; Gemini follows well-organized prompts effectively.
- Leverage its strong long-context window for tasks that require reading and reasoning over many files simultaneously.
- Be explicit about scope, constraints, and the exact artifact to return.
- For coding work, prefer sequential execution with explicit verification steps.
- Good for broad audits, architecture analysis, and tasks requiring synthesis across large codebases.
""".strip(),
    "gemini-3.0-flash": """
- Keep the prompt narrower, more prescriptive, and more sequential than for Gemini Pro.
- Prefer explicit scope limits, fixed step order, and short stop conditions.
- Ask for compact execution with strong instruction following rather than broad exploration.
- Use verification, but keep it lightweight and concrete.
- Flash is best when the task is already well-scoped, prescriptive, and low-risk.
""".strip(),
    "kimi-k2.5": """
- Kimi excels at long-context code understanding and agentic coding workflows.
- Use clear section structure with explicit step ordering.
- Leverage its strong long-context window for tasks that span many files.
- Be explicit about scope, constraints, verification steps, and the exact artifact to return.
- For coding work, prefer sequential execution with clear dependency chains.
- Good for agentic multi-step coding tasks that require sustained focus across a large codebase.
""".strip(),
    "minimax-m2.5": """
- MiniMax is efficient at structured output and batch processing tasks.
- Keep prompts concise and prescriptive with clear step ordering.
- Prefer explicit scope limits, fixed step order, and short stop conditions.
- Good for tasks requiring structured, repeatable output patterns.
- Use verification, but keep it lightweight and concrete.
""".strip(),
}

MODEL_KNOWLEDGE_FILES = {
    "gpt-5.4": "gpt-5.4.md",
    "gpt-5-mini": "gpt-5-mini.md",
    "claude-sonnet-4-6": "claude-sonnet-4-6.md",
    "claude-opus-4-6": "claude-opus-4-6.md",
    "claude-haiku-4-5": "claude-haiku-4-5.md",
    "gpt-4.1": "gpt-4.1.md",
    "gemini-3.0-flash": "gemini-3.0-flash.md",
    "gemini-3.0-pro": "gemini-3.0-pro.md",
    "kimi-k2.5": "kimi-k2.5.md",
    "minimax-m2.5": "minimax-m2.5.md",
}

TASK_COMPILATION_GUIDANCE = {
    "refactor": """
Task type: refactor

Compile a prompt for untangling an overgrown codebase safely.
The final prompt should:
- identify the specific mess the user wants addressed,
- preserve behavior unless the user explicitly wants behavior changes,
- separate diagnosis from implementation when that reduces risk,
- prefer staged refactors over broad rewrites,
- call out likely seams such as duplicated helpers, overgrown components, tangled file structure, or weak module boundaries,
- avoid unrelated cleanup unless it directly supports the refactor goal,
- explicitly tell GPT-5.4 to inspect before editing, verify before destructive changes, and use a short pre-flight/post-flight execution frame for risky steps,
- include coding-agent follow-through behavior so the model persists through diagnosis, implementation, verification, and a concise close-out unless the user explicitly requests planning only,
- include frontend-specific design rules only when the refactor touches UI or product surfaces.
""".strip(),
    "audit": """
Task type: audit

Compile a prompt for inspecting a codebase critically.
The final prompt should:
- make the audit lens explicit, such as necessity, duplication, structure, or behavior-versus-intent,
- require evidence-backed findings instead of vague impressions,
- distinguish critical issues from optional cleanup,
- state whether the desired output is findings only, a prioritized action list, or a follow-on refactor plan,
- compare implementation against the chosen source of truth when one is provided, such as user stories, creator intent, or current UX expectations,
- require GPT-5.4 to ground claims in repo evidence or tool outputs and label inferences clearly,
- use a research-style audit flow when the audit is broad: plan the audit lenses, retrieve evidence, then synthesize findings,
- keep implementation changes out of scope unless the user explicitly asks for a follow-on refactor or fix.
""".strip(),
    "frontend": """
Task type: frontend

Compile a prompt for improving an existing frontend surface without misframing the job as a broad refactor or a pure audit.
The final prompt should:
- treat the UI as a connected system of screens, components, layout, copy, hierarchy, state, and interactions,
- make the improvement goal explicit, such as stronger visual design, clearer onboarding, better hierarchy, more cohesive flows, or cleaner state feedback,
- preserve the current architecture and core behavior unless the user explicitly wants structural changes,
- distinguish what should stay stable from what is fair game to improve,
- surface UX tradeoffs, product assumptions, and collateral effects when visual or interaction changes affect other parts of the interface,
- bias toward concrete, implementation-ready frontend work rather than abstract design commentary when the user wants code changes,
- include frontend-specific design guidance only when relevant,
- keep the work grounded in the existing repo and current user-facing behavior instead of turning it into a zero-to-one redesign.
""".strip(),
    "implement": """
Task type: implement

Compile a prompt for executing a batch of small, concrete, prescriptive changes with no ambiguity.
The final prompt should:
- list each discrete change explicitly with file, component, and acceptance criteria,
- use a tight numbered step list rather than open-ended exploration,
- skip broad diagnosis or architecture discussion — the scope is already known,
- include a short verification step per change or a single batch verification at the end,
- keep the prompt compact and action-oriented,
- bias toward straightforward execution rather than deep reasoning.
""".strip(),
}

MODEL_OUTPUT_BLUEPRINTS = {
    "gpt-5.4": {
        "refactor": """
Required prompt structure for GPT-5.4 refactor work:
<context>
The user goal, current symptoms, unresolved uncertainty, and any relevant repo background.
</context>
<task>
The exact refactor job. State whether the model should diagnose first, then implement, or produce a staged refactor plan before code changes.
</task>
<repo_context>
Only the most relevant repo structure, seams, files, or subsystem context.
</repo_context>
<constraints>
- Preserve behavior unless the user explicitly wants behavior changes.
- Avoid unrelated cleanup.
- Keep changes reviewable and staged when the scope is broad.
- Do not invent missing repo details.
</constraints>
<reasoning_effort>
- Default to medium for messy multi-file refactors.
- Lower to low or none only when the work is already bounded and prescriptive.
- Raise to high only when the task clearly requires long-horizon synthesis.
</reasoning_effort>
<output_contract>
- Return exactly the sections requested, in the requested order.
- If the prompt asks for a preamble, plan, or working notes, do not treat them as extra final output.
- For diagnosis-first work, keep findings or plan separate from implementation.
- If a strict format is requested, output only that format.
</output_contract>
<verbosity_controls>
- Prefer concise, information-dense writing.
- Avoid repeating the user's request.
- Keep progress updates brief.
- Do not shorten the answer so aggressively that required verification or deliverables are omitted.
</verbosity_controls>
<default_follow_through_policy>
- If the user's intent is clear and the next step is reversible and low-risk, proceed without asking.
- Ask permission only for irreversible, externally consequential, or materially outcome-changing decisions.
- If proceeding, briefly state what was done and what remains optional.
</default_follow_through_policy>
<instruction_priority>
- User instructions override default style, tone, formatting, and initiative preferences.
- Safety, honesty, privacy, and permission constraints do not yield.
- If a newer user instruction conflicts with an earlier one, follow the newer instruction.
- Preserve earlier instructions that do not conflict.
</instruction_priority>
<tool_persistence_rules>
- Use tools whenever they materially improve correctness, completeness, or grounding.
- Do not stop early when another inspection or verification step is likely to improve correctness.
- Keep going until the task is complete and verification passes.
</tool_persistence_rules>
<dependency_checks>
- Before taking an action, check whether prerequisite discovery, lookup, or memory retrieval steps are required.
- Do not skip prerequisite steps just because the intended change seems obvious.
- Resolve dependencies before acting.
</dependency_checks>
<parallel_tool_calling>
- Parallelize only independent evidence-gathering steps.
- Do not parallelize steps with prerequisite dependencies or risky ordering constraints.
- After parallel retrieval, pause to synthesize before acting.
</parallel_tool_calling>
<completeness_contract>
- Treat the task as incomplete until all requested deliverables are covered or explicitly marked [blocked].
- Keep an internal checklist of required deliverables.
- If a broad refactor is safer in stages, make the stages explicit rather than silently widening scope.
</completeness_contract>
<empty_result_recovery>
- If inspection returns empty, partial, or suspiciously narrow results, try at least one fallback strategy before concluding nothing relevant exists.
</empty_result_recovery>
<verification_loop>
- Before finalizing, check correctness, grounding, formatting, and safety.
- Verify that requested changes or findings actually match the inspected code.
- Ask permission before irreversible or externally consequential actions.
</verification_loop>
<missing_context_gating>
- If required context is missing, do not guess.
- Prefer lookup or inspection when the missing context is retrievable.
- If you must proceed, label assumptions explicitly and choose a reversible action.
</missing_context_gating>
<action_safety>
- Pre-flight: summarize the intended edit or command in 1-2 lines.
- Execute via the available tool.
- Post-flight: confirm what changed and what verification passed.
</action_safety>
<autonomy_and_persistence>
- Persist until the task is fully handled end-to-end within the current turn whenever feasible.
- Do not stop at analysis or partial fixes when implementation is clearly requested.
- If you encounter challenges, resolve them or document the narrow blocker precisely.
</autonomy_and_persistence>
<user_updates_spec>
- Only update the user when starting a new major phase or when something changes the plan.
- Each update: 1 sentence on outcome and 1 sentence on next step.
- Do not narrate routine tool calls.
- Keep the user-facing status short while keeping the work exhaustive.
</user_updates_spec>
<terminal_tool_hygiene>
- Only run shell commands via the terminal tool.
- If a patch or edit tool exists, use it directly rather than simulating edits in bash.
- Run a lightweight verification step before declaring the task done.
</terminal_tool_hygiene>
<formatting_rules>
- Prefer short paragraphs unless the content is inherently list-shaped.
- Never use nested bullets.
- For numbered lists, use 1. 2. 3.
</formatting_rules>
Optional sections when relevant:
- <task_update> for scoped mid-conversation overrides.
- <structured_output_contract> for parse-sensitive outputs.
- <frontend_tasks> for frontend-heavy refactors.
- <grounding_rules> if the refactor requires evidence-heavy diagnosis before implementation.
""".strip(),
        "audit": """
Required prompt structure for GPT-5.4 audit work:
<context>
The audit goal, current uncertainty, source of truth, and any relevant repo background.
</context>
<task>
The exact audit job. State whether the desired output is findings only, a prioritized action list, or a follow-on refactor plan.
</task>
<repo_context>
Only the most relevant repo structure, files, flows, or subsystem context.
</repo_context>
<constraints>
- Do not invent missing repo details.
- Keep implementation changes out of scope unless the user explicitly asks for them.
- Distinguish observed facts from inferences and recommendations.
</constraints>
<reasoning_effort>
- Default to medium for broad evidence-heavy audits.
- Lower to low or none only for bounded, prescriptive audits.
- Raise to high only when the audit requires long-horizon synthesis across many files or competing signals.
</reasoning_effort>
<output_contract>
- Return exactly the sections requested, in the requested order.
- Present findings before summary or recommendations unless the user requests another format.
- Attach concrete repo evidence to each substantive claim, such as file paths, symbols, or observed behavior.
- If a strict format is requested, output only that format.
</output_contract>
<verbosity_controls>
- Prefer concise, information-dense writing.
- Avoid repeating the user's request.
- Keep progress updates brief.
- Do not omit evidence, uncertainty, or completion checks.
</verbosity_controls>
<default_follow_through_policy>
- If the user's intent is clear and the next step is reversible and low-risk, proceed without asking.
- Ask permission only for irreversible, externally consequential, or materially outcome-changing decisions.
</default_follow_through_policy>
<instruction_priority>
- User instructions override default style, tone, formatting, and initiative preferences.
- Safety, honesty, privacy, and permission constraints do not yield.
- If a newer user instruction conflicts with an earlier one, follow the newer instruction.
- Preserve earlier instructions that do not conflict.
</instruction_priority>
<tool_persistence_rules>
- Use tools whenever they materially improve correctness, completeness, or grounding.
- Do not stop early when another inspection step is likely to improve correctness.
- Keep going until the audit is complete and verification passes.
</tool_persistence_rules>
<dependency_checks>
- Resolve prerequisite discovery steps before drawing conclusions.
- Do not skip repo inspection just because the likely finding feels obvious.
- If one audit question depends on another step's result, resolve that dependency first.
</dependency_checks>
<parallel_tool_calling>
- Parallelize independent evidence-gathering steps.
- Do not parallelize steps with prerequisite dependencies or where one result determines the next action.
- After parallel retrieval, synthesize before continuing.
</parallel_tool_calling>
<completeness_contract>
- Treat the audit as incomplete until all requested lenses are covered or explicitly marked [blocked].
- Keep an internal checklist of required deliverables.
- For wide audits, track which files, flows, or subsystems have been examined.
</completeness_contract>
<empty_result_recovery>
- If inspection returns empty, partial, or suspiciously narrow results, try one or two fallback strategies before concluding there is nothing relevant.
</empty_result_recovery>
<grounding_rules>
- Base claims only on provided repo context or tool outputs.
- If sources or observations conflict, state the conflict explicitly and attribute each side.
- If a statement is an inference rather than directly observed, label it as an inference.
- If the inspected context is insufficient, narrow the claim or say it cannot yet be supported.
</grounding_rules>
<research_mode>
- Do the audit in 3 passes:
  1. Plan: list 3-6 audit questions or lenses.
  2. Retrieve: inspect the relevant files, symbols, or repo areas for each lens and follow 1-2 second-order leads.
  3. Synthesize: resolve contradictions and write the final answer with evidence.
- Stop only when more inspection is unlikely to change the conclusion.
</research_mode>
<dig_deeper_nudge>
- Do not stop at the first plausible conclusion.
- Look for second-order issues, edge cases, and missing constraints.
- Perform at least one verification step before finalizing safety- or accuracy-critical claims.
</dig_deeper_nudge>
<verification_loop>
- Before finalizing, check correctness, grounding, formatting, and safety.
- Verify that each major finding is backed by concrete evidence from the inspected code.
- Confirm that the output shape matches the requested review format.
</verification_loop>
<missing_context_gating>
- If required context is missing, do not guess.
- Prefer the appropriate lookup or inspection step when the missing context is retrievable.
- If you must proceed, label assumptions explicitly and narrow the conclusion.
</missing_context_gating>
<autonomy_and_persistence>
- Persist until the audit is fully handled end-to-end within the current turn whenever feasible.
- Do not stop after partial coverage when the user asked for a broad audit.
- If blocked, state exactly what is missing and why it matters.
</autonomy_and_persistence>
<user_updates_spec>
- Only update the user when starting a new major phase or when something changes the plan.
- Each update: 1 sentence on outcome and 1 sentence on next step.
- Do not narrate routine tool calls.
</user_updates_spec>
<terminal_tool_hygiene>
- Only run shell commands via the terminal tool.
- If a patch or edit tool exists, use it directly.
- Run a lightweight verification step before declaring the audit complete.
</terminal_tool_hygiene>
<formatting_rules>
- Prefer short paragraphs unless the content is inherently list-shaped.
- Never use nested bullets.
- For numbered lists, use 1. 2. 3.
</formatting_rules>
Optional sections when relevant:
- <task_update> for scoped mid-conversation overrides.
- <structured_output_contract> for parse-sensitive outputs.
- <citation_rules> only when external sources are part of the workflow.
- <frontend_tasks> if the audit is specifically about frontend design or UX implementation quality.
""".strip(),
        "frontend": """
Required prompt structure for GPT-5.4 frontend iteration work:
<context>
The current frontend situation, what feels wrong, what should be preserved, and any relevant repo or product background.
</context>
<task>
The exact frontend improvement job. State whether the model should critique first, implement directly, or propose a staged UI improvement plan before editing.
</task>
<repo_context>
Only the most relevant screens, components, styling systems, state boundaries, or interaction flows.
</repo_context>
<constraints>
- Preserve existing product behavior unless the user explicitly wants behavior changes.
- Do not turn the task into a ground-up rewrite unless the user asks for one.
- Do not invent missing repo details or product requirements.
- Keep related UI surfaces coherent when one change affects another.
</constraints>
<reasoning_effort>
- Default to medium for connected frontend work across multiple components or flows.
- Lower to low only when the task is narrow and visually prescriptive.
- Raise to high only when the work requires major UX, architecture, and behavior tradeoff synthesis.
</reasoning_effort>
<output_contract>
- Return exactly the sections requested, in the requested order.
- Separate critique, plan, and implementation when that reduces risk.
- If a strict format is requested, output only that format.
</output_contract>
<verbosity_controls>
- Prefer concise, information-dense writing.
- Avoid repeating the user's request.
- Keep progress updates brief.
- Do not omit necessary implementation details, constraints, or verification.
</verbosity_controls>
<default_follow_through_policy>
- If the user's intent is clear and the next step is reversible and low-risk, proceed without asking.
- Ask permission only for irreversible, externally consequential, or materially outcome-changing decisions.
</default_follow_through_policy>
<tool_persistence_rules>
- Use tools whenever they materially improve correctness, completeness, or grounding.
- Do not stop early when another inspection or verification step is likely to improve the frontend outcome.
</tool_persistence_rules>
<dependency_checks>
- Before changing a frontend surface, inspect the connected components, styling tokens, state boundaries, and interaction flows it depends on.
- Do not treat a shared UI system as an isolated file change when it is not.
</dependency_checks>
<completeness_contract>
- Treat the task as incomplete until all requested surfaces, flows, or components are covered or explicitly marked [blocked].
- Keep an internal checklist of the UI surfaces affected by the change.
</completeness_contract>
<verification_loop>
- Before finalizing, check correctness, grounding, formatting, and UX coherence.
- Verify that related UI surfaces still work together after the change.
- Check mobile and desktop implications when relevant.
</verification_loop>
<missing_context_gating>
- If required context is missing, do not guess.
- Prefer repo inspection when the missing context is retrievable.
- If you must proceed, label assumptions explicitly and choose a reversible direction.
</missing_context_gating>
<autonomy_and_persistence>
- Persist until the frontend improvement is fully handled end to end within the current turn whenever feasible.
- Do not stop at vague design commentary when implementation is clearly requested.
</autonomy_and_persistence>
<frontend_tasks>
- Treat the first viewport and the surrounding interaction model as one composition, not a pile of disconnected cards.
- Improve hierarchy, copy clarity, spacing rhythm, and interaction feedback together.
- Preserve the existing design system when one exists; otherwise create a clear direction rather than generic defaults.
</frontend_tasks>
<terminal_tool_hygiene>
- Only run shell commands via the terminal tool.
- If a patch or edit tool exists, use it directly.
- Run a lightweight verification step before declaring the task done.
</terminal_tool_hygiene>
""".strip(),
        "implement": """
Required prompt structure for GPT-5.4 implement work:
<context>
Short background on the batch of changes requested.
</context>
<task>
The exact list of discrete changes. Each change specifies the file, component, and what to do.
</task>
<repo_context>
Only the files and components directly touched by the changes.
</repo_context>
<steps>
A numbered list of concrete steps, one per change or logical group.
</steps>
<constraints>
- Do not widen scope beyond the listed changes.
- Do not refactor or reorganize surrounding code.
- Preserve existing behavior for everything not explicitly listed.
</constraints>
<output_contract>
Return the completed changes. Keep output compact.
</output_contract>
<verification_loop>
Run one lightweight verification step per change or a single batch check at the end.
</verification_loop>
""".strip(),
    },
    "claude-sonnet-4-6": {
        "refactor": """
Required prompt structure for Claude Sonnet 4.6 refactor work:
<context>
The user goal, current symptoms, unresolved uncertainty, and why this refactor matters.
</context>
<task>
The exact refactor job. State clearly whether the model should diagnose first, then implement, or produce a staged refactor plan before editing.
</task>
<project_context>
Only the most relevant repo structure, files, seams, or subsystem context.
</project_context>
<constraints>
- Preserve behavior unless the user explicitly wants behavior changes.
- Do not add extra features.
- Do not widen the scope silently.
- Avoid unrelated cleanup.
- Do not invent missing repo details.
</constraints>
<execution_rules>
- Inspect before editing.
- Resolve prerequisite lookups before acting.
- Prefer staged, reviewable refactors when the scope is broad.
- Surface contradictions, risky edges, dead code, and collateral damage explicitly.
- If the refactor touches frontend surfaces, treat related components, layout, state, and UX behavior as one connected system.
</execution_rules>
<output_contract>
- Return exactly the artifact the user asked for, in the requested order.
- Keep diagnosis, plan, and implementation separate when that reduces risk.
- If a strict format is requested, output only that format.
</output_contract>
<verification>
- Check that the proposed or implemented changes match the requested behavior.
- Verify that constraints and non-goals were respected.
- Run at least one lightweight verification step before finishing.
- If blocked, say exactly what is missing or risky.
</verification>
Optional sections when relevant:
- <frontend_system> for connected UI/component work.
- <formatting> for strict response-shape rules.
- <examples> when one or two examples would materially reduce ambiguity.
""".strip(),
        "audit": """
Required prompt structure for Claude Sonnet 4.6 audit work:
<context>
The audit goal, source of truth, current uncertainty, and why this audit matters.
</context>
<task>
The exact audit job. State whether the desired output is findings only, a prioritized action list, or a follow-on refactor plan.
</task>
<project_context>
Only the most relevant repo structure, files, flows, or subsystem context.
</project_context>
<constraints>
- Do not invent missing repo details.
- Keep implementation changes out of scope unless the user explicitly asks for them.
- Distinguish observed facts from inferences and recommendations.
- Do not pad the answer with generic advice.
</constraints>
<audit_rules>
- Inspect enough of the codebase to support each major claim.
- Follow dependencies before drawing conclusions.
- Surface contradictions, unnecessary code, duplicated responsibilities, dead abstractions, and behavior-versus-intent mismatches explicitly.
- If the audit is frontend-heavy, evaluate the UI as a connected system rather than isolated components.
</audit_rules>
<output_contract>
- Return exactly the requested review format.
- Present findings before summary or recommendations unless the user requests otherwise.
- Attach concrete evidence such as file paths, symbols, flows, or observed behavior to each substantive claim.
</output_contract>
<verification>
- Confirm that each major finding is grounded in inspected code.
- Check that the requested audit lenses were all covered or explicitly marked [blocked].
- Run one lightweight verification step before finalizing.
</verification>
Optional sections when relevant:
- <frontend_system> for design-system or component-cohesion audits.
- <prioritization> when the user wants findings ranked by severity or impact.
- <follow_on_plan> when the audit should end with a refactor sequence.
""".strip(),
        "frontend": """
Required prompt structure for Claude Sonnet 4.6 frontend iteration work:
<context>
The current frontend situation, what feels wrong, what should stay stable, and why this improvement matters.
</context>
<task>
The exact frontend improvement job. State whether the model should critique first, implement directly, or propose a staged UI improvement plan before editing.
</task>
<project_context>
Only the most relevant screens, components, styling rules, state boundaries, and interaction flows.
</project_context>
<constraints>
- Preserve existing core behavior unless the user explicitly wants behavior changes.
- Do not add extra features.
- Do not silently turn this into a broad refactor or a zero-to-one redesign.
- Keep improvements compatible with the existing architecture unless the user explicitly asks otherwise.
- Do not invent missing repo details or product intent.
</constraints>
<frontend_system>
- Treat the affected frontend as one connected system, not isolated files.
- Consider component relationships, shared state, visual hierarchy, layout rhythm, copy clarity, responsiveness, and accessibility together.
- If one surface changes, account for the dependent panels, controls, banners, or flows around it.
</frontend_system>
<execution_rules>
- Inspect before editing.
- Resolve prerequisite lookups before acting.
- Surface UX tradeoffs, contradictions, and collateral effects explicitly.
- Keep implementation grounded in the existing codebase and design language.
</execution_rules>
<output_contract>
- Return exactly the artifact the user asked for, in the requested order.
- Separate critique, plan, and implementation when that reduces risk.
- If a strict format is requested, output only that format.
</output_contract>
<verification>
- Check that the resulting UI direction matches the user's improvement goal.
- Verify that related components and flows remain coherent.
- Run at least one lightweight verification step before finishing.
- If blocked, say exactly what is missing or risky.
</verification>
Optional sections when relevant:
- <design_direction> for the intended visual or interaction direction.
- <interconnections> for how the touched files and UI surfaces relate to each other.
- <responsive_checks> when mobile and desktop behavior both matter.
""".strip(),
        "implement": """
Required prompt structure for Claude Sonnet 4.6 implement work:
<context>
Short background on the batch of changes requested.
</context>
<task>
The exact list of discrete changes. Each change specifies the file, component, and what to do.
</task>
<project_context>
Only the files and components directly touched by the changes.
</project_context>
<steps>
A numbered list of concrete steps, one per change or logical group.
</steps>
<constraints>
- Do not widen scope beyond the listed changes.
- Do not refactor or reorganize surrounding code.
- Preserve existing behavior for everything not explicitly listed.
</constraints>
<output_contract>
Return the completed changes. Keep output compact.
</output_contract>
<verification>
Run one lightweight verification step per change or a single batch check at the end.
</verification>
""".strip(),
    },
    "gpt-5-mini": """
Final prompt structure:
<context>
Short task background.
</context>
<task>
The exact bounded job.
</task>
<scope>
What to inspect or change, and what to ignore.
</scope>
<steps>
1. Inspect the named area.
2. Perform the bounded task.
3. Verify the result.
</steps>
<output_contract>
Return only the requested artifact in the requested shape.
</output_contract>
<stop_conditions>
Stop when the bounded task is complete or when required context is missing.
</stop_conditions>
<verification_loop>
Run one lightweight verification step before finishing.
</verification_loop>
""".strip(),
    "claude-opus-4-6": {
        "refactor": """
Required prompt structure for Claude Opus 4.6 refactor work:
<context>
The user goal, current symptoms, unresolved uncertainty, and why this refactor matters.
</context>
<task>
The exact refactor job. State clearly whether the model should diagnose first, then implement, or produce a staged refactor plan before editing.
</task>
<project_context>
Only the most relevant repo structure, files, seams, or subsystem context.
</project_context>
<constraints>
- Preserve behavior unless the user explicitly wants behavior changes.
- Do not add extra features or widen scope silently.
- Avoid unrelated cleanup.
</constraints>
<execution_rules>
- Inspect before editing.
- Resolve prerequisite lookups before acting.
- Prefer staged, reviewable refactors when the scope is broad.
- Surface architectural tradeoffs, second-order effects, and long-term maintainability concerns.
</execution_rules>
<output_contract>
Return exactly the artifact the user asked for, in the requested order.
</output_contract>
<verification>
Check correctness, grounding, and that constraints were respected. Run at least one verification step before finishing.
</verification>
""".strip(),
        "audit": """
Required prompt structure for Claude Opus 4.6 audit work:
<context>
The audit goal, source of truth, current uncertainty, and why this audit matters.
</context>
<task>
The exact audit job. State whether the desired output is findings only, a prioritized action list, or a follow-on refactor plan.
</task>
<project_context>
Only the most relevant repo structure, files, flows, or subsystem context.
</project_context>
<constraints>
- Do not invent missing repo details.
- Keep implementation changes out of scope unless the user explicitly asks.
- Distinguish observed facts from inferences.
</constraints>
<audit_rules>
- Inspect enough of the codebase to support each major claim.
- Follow dependencies before drawing conclusions.
- Surface contradictions, unnecessary code, and behavior-versus-intent mismatches.
</audit_rules>
<output_contract>
Return exactly the requested review format with concrete evidence attached to each claim.
</output_contract>
<verification>
Confirm each finding is grounded in inspected code. Run one verification step before finalizing.
</verification>
""".strip(),
        "frontend": """
Required prompt structure for Claude Opus 4.6 frontend iteration work:
<context>
The current frontend situation, what feels wrong, what should stay stable, and why this improvement matters.
</context>
<task>
The exact frontend improvement job.
</task>
<project_context>
Only the most relevant screens, components, styling rules, state boundaries, and interaction flows.
</project_context>
<constraints>
- Preserve existing core behavior unless the user explicitly wants changes.
- Do not silently turn this into a broad refactor or zero-to-one redesign.
</constraints>
<frontend_system>
Treat the affected frontend as one connected system. Consider component relationships, shared state, visual hierarchy, and accessibility together.
</frontend_system>
<output_contract>
Return exactly the artifact the user asked for.
</output_contract>
<verification>
Check that the UI direction matches the user's goal and related flows remain coherent.
</verification>
""".strip(),
        "implement": """
Required prompt structure for Claude Opus 4.6 implement work:
<context>
Short background on the batch of changes requested.
</context>
<task>
The exact list of discrete changes. Each change specifies the file, component, and what to do.
</task>
<project_context>
Only the files and components directly touched by the changes.
</project_context>
<steps>
A numbered list of concrete steps, one per change or logical group.
</steps>
<constraints>
- Do not widen scope beyond the listed changes.
- Preserve existing behavior for everything not explicitly listed.
</constraints>
<output_contract>
Return the completed changes. Keep output compact.
</output_contract>
<verification>
Run one lightweight verification step per change or a single batch check at the end.
</verification>
""".strip(),
    },
    "claude-haiku-4-5": """
Final prompt structure:
<context>
Short task background.
</context>
<task>
The exact bounded job.
</task>
<scope>
What to inspect or change, and what to ignore.
</scope>
<steps>
1. Inspect the named area.
2. Perform the bounded task.
3. Verify the result.
</steps>
<output_contract>
Return only the requested artifact in the requested shape.
</output_contract>
<stop_conditions>
Stop when the bounded task is complete or when required context is missing.
</stop_conditions>
<verification_loop>
Run one lightweight verification step before finishing.
</verification_loop>
""".strip(),
    "gpt-4.1": """
Final prompt structure:
<context>
Short task background.
</context>
<task>
The exact bounded job.
</task>
<scope>
What to inspect or change, and what to ignore.
</scope>
<steps>
1. Inspect the named area.
2. Perform the bounded task.
3. Verify the result.
</steps>
<output_contract>
Return only the requested artifact in the requested shape.
</output_contract>
<stop_conditions>
Stop when the bounded task is complete or when required context is missing.
</stop_conditions>
<verification_loop>
Run one lightweight verification step before finishing.
</verification_loop>
""".strip(),
    "gemini-3.0-pro": """
Final prompt structure:
<context>
Short task background.
</context>
<task>
The exact bounded job.
</task>
<scope>
What to inspect or change, and what to ignore.
</scope>
<steps>
1. Inspect the named area.
2. Perform the bounded task.
3. Verify the result.
</steps>
<output_contract>
Return only the requested artifact in the requested shape.
</output_contract>
<stop_conditions>
Stop when the bounded task is complete or when required context is missing.
</stop_conditions>
<verification_loop>
Run one lightweight verification step before finishing.
</verification_loop>
""".strip(),
    "gemini-3.0-flash": """
Final prompt structure:
<context>
Short task background.
</context>
<task>
The exact bounded job.
</task>
<scope>
What to inspect or change, and what to ignore.
</scope>
<steps>
1. Inspect the named area.
2. Perform the bounded task.
3. Verify the result.
</steps>
<output_contract>
Return only the requested artifact in the requested shape.
</output_contract>
<stop_conditions>
Stop when the bounded task is complete or when required context is missing.
</stop_conditions>
<verification_loop>
Run one lightweight verification step before finishing.
</verification_loop>
""".strip(),
    "kimi-k2.5": """
Final prompt structure:
<context>
Short task background.
</context>
<task>
The exact bounded job.
</task>
<scope>
What to inspect or change, and what to ignore.
</scope>
<steps>
1. Inspect the named area.
2. Perform the bounded task.
3. Verify the result.
</steps>
<output_contract>
Return only the requested artifact in the requested shape.
</output_contract>
<stop_conditions>
Stop when the bounded task is complete or when required context is missing.
</stop_conditions>
<verification_loop>
Run one lightweight verification step before finishing.
</verification_loop>
""".strip(),
    "minimax-m2.5": """
Final prompt structure:
<context>
Short task background.
</context>
<task>
The exact bounded job.
</task>
<scope>
What to inspect or change, and what to ignore.
</scope>
<steps>
1. Inspect the named area.
2. Perform the bounded task.
3. Verify the result.
</steps>
<output_contract>
Return only the requested artifact in the requested shape.
</output_contract>
<stop_conditions>
Stop when the bounded task is complete or when required context is missing.
</stop_conditions>
<verification_loop>
Run one lightweight verification step before finishing.
</verification_loop>
""".strip(),
}

COMPILER_SYSTEM_PROMPT = """You are the prompt compiler for Prompt OS.

Transform rough intent, clarifying answers, and project context into a prompt that is ready to paste into the selected target model.

Core rules:
- Output only the compiled prompt text.
- Write a prompt that helps the downstream model execute, not a summary for the user.
- Preserve the user's goal and uncertainty honestly.
- Keep the compiled prompt grounded in the supplied intent, answers, and repo context only. Do not invent missing facts.
- If ambiguity remains, encode it as assumptions to verify, not as false certainty.
- Prefer concrete deliverables, scope boundaries, and verification expectations over abstract advice.
- Include safety constraints around destructive actions, risky refactors, and unverifiable assumptions.
- For GPT-5.4 targets, lift the relevant official GPT-5.4 prompt blocks directly into the final prompt instead of only paraphrasing them.
- For Claude Sonnet 4.6 targets, prefer clean XML structure, explicit constraints, and concise verification instructions.
- Distinguish prompt-level guidance from runtime-only API controls. Do not imply that the prompt itself can set fields such as phase or previous_response_id.
- Do not mention Prompt OS, hidden system prompts, or internal compiler logic.
- Do not add markdown code fences around the final prompt.
"""


def get_model_compilation_guidance(model_name: str) -> str:
    return "\n\n".join(
        [
            "Target model knowledge base:",
            _load_model_knowledge(model_name),
            "",
            "Compiler-specific instructions:",
            MODEL_COMPILATION_GUIDANCE[model_name],
        ]
    ).strip()


def get_task_compilation_guidance(task_type: str) -> str:
    return TASK_COMPILATION_GUIDANCE[task_type]


def get_model_output_blueprint(model_name: str, task_type: str) -> str:
    blueprint = MODEL_OUTPUT_BLUEPRINTS[model_name]
    if isinstance(blueprint, dict):
        return blueprint[task_type]
    return blueprint


@lru_cache(maxsize=None)
def _load_model_knowledge(model_name: str) -> str:
    models_dir = Path(__file__).resolve().parents[2] / "kernel" / "models"
    model_path = models_dir / MODEL_KNOWLEDGE_FILES[model_name]
    return model_path.read_text(encoding="utf-8").strip()
