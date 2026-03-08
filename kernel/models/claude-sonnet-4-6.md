# Claude Sonnet 4.6

## Role

Best-value audience model for structured coding work that still needs strong intelligence, especially connected frontend systems and medium-complexity refactors or audits.

## Best fit

- React + TypeScript frontend systems
- medium-complexity refactors with explicit constraints
- audits that need disciplined structure without flagship-level synthesis cost
- multi-file UI work where components, state, layout, and behavior need to stay coherent

## Prompting guidance

- Use clean XML tags to separate context, task, repo context, constraints, and verification.
- Be explicit, direct, and detailed about scope, output shape, and non-goals.
- Give the model enough context to understand why the task matters, not just what to do.
- Use clear sequential steps for coding work.
- Let the model think internally step by step, but request only the user-visible sections you actually need.
- For tool-heavy flows, make prerequisite checks and verification expectations explicit.
- For frontend work, tell it to reason about connected components, shared state, hierarchy, and interaction quality as one system.

## Strengths

- Officially released by Anthropic on February 17, 2026.
- Marketed by Anthropic as their best speed-to-intelligence combination in the Claude family.
- Stronger than Sonnet 4.5 on coding, computer use, long-context reasoning, agent planning, and design.
- Early-access developers reportedly preferred it to Sonnet 4.5 by a wide margin.
- Anthropic explicitly positions it as strong for polished frontend work and connected UI tasks.

## Known limitations

- Anthropic still positions Opus 4.6 as stronger for the deepest reasoning, codebase-wide refactors, and multi-agent coordination.
- It benefits from stricter scaffolding than GPT-5.4 when the task is ambiguous or contradiction-heavy.
- If the brief is underspecified, it may stay too literal unless you explicitly ask it to surface tradeoffs and second-order effects.
- For parse-sensitive outputs, you still need a strict format contract.

## Compiler notes

- Bias toward Claude Sonnet 4.6 for frontend-heavy refactors and audits, especially React + TypeScript surfaces with shared state or coordinated components.
- Bias toward GPT-5.4 instead when the main risk is ambiguity, contradiction resolution, architecture-level synthesis, or broad collateral-damage analysis.
- Keep prompts XML-structured and constraint-forward.
- Add frontend-specific guidance only when the task actually touches product surfaces.
- Prefer explicit verification checklists and exact scope boundaries.
