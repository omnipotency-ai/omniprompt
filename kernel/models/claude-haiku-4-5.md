# Claude Haiku 4.5

## Role

Fastest, cheapest audience model in the Claude family for bounded, well-specified tasks where speed and cost matter more than deep reasoning.

## Best fit

- simple code changes with clear specifications
- batch processing and repetitive transformations
- routine operations: renames, reformats, type additions, boilerplate generation
- well-scoped inspections with explicit criteria
- tasks where latency and token cost are the primary constraints

## Prompting guidance

- Keep instructions narrow, sequential, and explicit — Haiku follows precise instructions well.
- Use short scope statements, numbered steps, and exact output contracts.
- Avoid ambiguity: spell out exactly what to do and what not to do.
- Use XML tags for structure, same as other Claude models, but keep sections concise.
- Provide explicit stop conditions and deliverable definitions.
- Don't rely on Haiku to surface tradeoffs or second-order effects — state your constraints directly.
- For batch work, give a clear pattern with one example and let it repeat.

## Strengths

- Extremely fast response times and low cost per token.
- Strong instruction following when the brief is well-specified.
- Reliable at pattern-matching tasks: apply this change across N files, extract this data, reformat this output.
- Good at simple code generation, type definitions, and boilerplate.
- Efficient for high-volume, low-complexity workflows.

## Known limitations

- Limited on complex multi-step reasoning — will miss subtle interactions and edge cases.
- Poor at ambiguity resolution: if the brief is vague, Haiku will guess rather than ask or flag uncertainty.
- Not suitable for architecture decisions, broad refactors, or tasks requiring synthesis across many files.
- Weaker at surfacing contradictions, hidden dependencies, or collateral damage.
- For parse-sensitive or safety-critical outputs, add strict format contracts and validation steps.

## Compiler notes

- Bias toward Haiku 4.5 for simple, well-specified tasks where speed and cost dominate.
- Bias toward Sonnet 4.6 instead when the task needs moderate reasoning or connected-system awareness.
- Bias toward Opus 4.6 instead for anything requiring deep reasoning, synthesis, or ambiguity handling.
- Keep prompts short, direct, and prescriptive — Haiku works best with minimal ambiguity.
- Use explicit output contracts and numbered steps.
- Avoid giving Haiku broad or open-ended briefs.
