# Claude Opus 4.6

## Role

Most capable audience model in the Claude family for deep reasoning, long-horizon planning, and complex architecture decisions where quality outweighs speed and cost.

## Best fit

- codebase-wide refactors with many interacting constraints
- complex architecture decisions requiring multi-step reasoning and tradeoff analysis
- tasks requiring synthesis across many files, domains, or conflicting requirements
- multi-agent coordination and long-horizon planning
- deep audits where subtle second-order effects and edge cases must be surfaced

## Prompting guidance

- Use clean XML tags to separate context, task, constraints, and verification — same structure as Sonnet.
- Give rich context: Opus thrives when it understands the full picture, not just the immediate task.
- For complex tasks, let it reason through tradeoffs and surface concerns before committing to a plan.
- Explicitly request multi-step reasoning when the task has hidden dependencies or non-obvious interactions.
- You can afford longer, more nuanced briefs — Opus handles ambiguity and contradiction better than any other Claude model.
- For architecture work, ask it to enumerate alternatives with pros/cons before choosing.
- Use verification checklists, but trust Opus to catch things you didn't think to check.

## Strengths

- Anthropic's flagship reasoning model, positioned as the strongest Claude for the hardest tasks.
- Excels at synthesis: connecting information across large codebases, long documents, and complex requirement sets.
- Strong at surfacing contradictions, hidden dependencies, and collateral damage without explicit prompting.
- Handles nuance and ambiguity better than Sonnet — less likely to go overly literal on underspecified briefs.
- Best Claude model for multi-agent coordination and long-horizon agentic workflows.
- Deep code understanding: can reason about architecture, not just syntax.

## Known limitations

- Slowest and most expensive Claude model — overkill for bounded, well-specified tasks.
- For simple code changes, cleanups, or narrow inspections, Sonnet or Haiku are better value.
- Higher latency means it's a poor fit for rapid iteration loops or batch processing.
- Still benefits from XML structure and explicit scope — don't assume it will self-organize a vague brief perfectly.

## Compiler notes

- Bias toward Opus 4.6 when the task involves deep reasoning, codebase-wide impact, architecture decisions, or ambiguity resolution.
- Bias toward Sonnet 4.6 instead for routine frontend work, medium-complexity refactors, and structured coding where speed matters.
- Bias toward Haiku 4.5 instead for simple, bounded tasks where cost and speed dominate.
- Keep prompts XML-structured and give generous context — Opus uses it well.
- For architecture tasks, add an explicit "enumerate alternatives before deciding" step.
- Prefer explicit verification but allow Opus latitude to surface concerns beyond the checklist.
