# GPT-4.1

## Role

Reliable general-purpose audience model for structured coding work, strong at instruction following, function calling, and consistent formatted output.

## Best fit

- structured code generation with explicit requirements
- tasks requiring function calling or tool use
- JSON-mode and structured output tasks
- medium-complexity coding work where reliability and consistency matter
- API integration work and data transformation pipelines
- tasks that benefit from strong instruction adherence without flagship-level cost

## Prompting guidance

- Use clear, explicit instructions with well-defined output contracts.
- Leverage JSON mode or structured output when you need consistent formatting.
- For tool-use workflows, define function schemas precisely — GPT-4.1 follows them reliably.
- Use numbered steps for sequential tasks.
- Be explicit about scope boundaries and stop conditions.
- Prefer concise, direct instructions over long narrative context.
- For code tasks, specify language, style expectations, and edge cases up front.
- Use system messages to set behavioral constraints and output format.

## Strengths

- Strong, reliable instruction following across a wide range of tasks.
- Excellent at function calling and structured output — one of the best models for tool-use workflows.
- Good balance of capability and cost for everyday coding work.
- Consistent output formatting when given clear schema or examples.
- Solid code generation across popular languages and frameworks.
- Handles multi-turn conversations and context well within its window.

## Known limitations

- Less capable than GPT-5.4 at deep synthesis, ambiguity resolution, and long-horizon reasoning.
- For codebase-wide refactors or complex architecture decisions, a flagship model is a better fit.
- Smaller context window than Gemini models — not ideal for very large file analysis.
- May follow instructions too literally when the brief has gaps — less likely to surface missing context than flagship models.
- For the hardest reasoning tasks, GPT-5.4 or Claude Opus are stronger choices.

## Compiler notes

- Bias toward GPT-4.1 for straightforward coding tasks, structured output, and tool-use workflows where cost efficiency matters.
- Bias toward GPT-5.4 instead for ambiguous, synthesis-heavy, or long-horizon tasks.
- Bias toward Claude Sonnet 4.6 instead for frontend-heavy React/TypeScript work.
- Keep prompts structured and instruction-forward.
- Use explicit output schemas when formatted responses are needed.
- Prefer function-calling patterns for multi-step tool workflows.
