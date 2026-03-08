# Gemini 3.0 Flash

## Role

Google's fast, cost-efficient model for routine tasks and quick iterations where speed matters more than deep reasoning.

## Best fit

- quick code generation and simple edits
- routine inspections and lightweight audits
- rapid iteration and prototyping loops
- batch processing and data transformation
- tasks where cost efficiency and low latency are priorities

## Prompting guidance

- Keep instructions concise, direct, and well-scoped.
- Use numbered steps for sequential tasks.
- Provide explicit output contracts and examples when formatting matters.
- Use Markdown structure with clear headers — avoid XML tags.
- Set tight scope boundaries and stop conditions.
- Don't rely on Flash to surface tradeoffs or hidden complexity — state constraints explicitly.
- For batch work, provide a clear template and let it repeat the pattern.
- Use structured output mode for consistent JSON responses.

## Strengths

- Fast response times and low cost per token.
- Good code generation capabilities for straightforward tasks.
- Decent context window inherited from the Gemini family.
- Supports structured output for consistent formatting.
- Efficient for high-volume, low-complexity workflows.
- Good at pattern-matching tasks and templated operations.

## Known limitations

- Less reasoning depth than Gemini 3.0 Pro — will miss subtle interactions and complex dependencies.
- Not suitable for architecture decisions, broad refactors, or deep synthesis tasks.
- Weaker at ambiguity resolution — needs explicit, well-specified briefs.
- For complex multi-step reasoning, use Pro or a flagship model from another family.
- Less reliable on edge cases and nuanced requirements compared to flagship models.

## Compiler notes

- Bias toward Gemini 3.0 Flash for routine, well-specified tasks where speed and cost are the priority.
- Bias toward Gemini 3.0 Pro instead when the task needs deep reasoning or large-context analysis.
- Bias toward GPT-5 Mini or Claude Haiku 4.5 as alternative fast models depending on ecosystem fit.
- Use Markdown structure, not XML tags.
- Keep prompts short, prescriptive, and explicit.
- Use structured output mode when formatted responses are needed.
