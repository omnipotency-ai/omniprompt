# GPT-5.4

## Role

Flagship audience model for ambiguous, cross-file, synthesis-heavy software work.

## Best fit

- broad refactors
- evidence-heavy audits
- long-horizon coding tasks
- cases where contradictions, hidden dependencies, or collateral damage need to be surfaced before editing

## Prompting guidance

- Use explicit XML-style control blocks.
- Make output contracts, completion criteria, and verification loops explicit.
- Give the model a precise definition of what "done" means.
- Keep tool boundaries clear for coding workflows.
- Prefer concise, information-dense instructions over long prose.
- Use reasoning effort intentionally rather than defaulting to maximum effort.

## High-value control blocks

- `<reasoning_effort>`
- `<output_contract>`
- `<verbosity_controls>`
- `<default_follow_through_policy>`
- `<instruction_priority>`
- `<tool_persistence_rules>`
- `<dependency_checks>`
- `<parallel_tool_calling>`
- `<completeness_contract>`
- `<empty_result_recovery>`
- `<verification_loop>`
- `<missing_context_gating>`

## Coding notes

- Strong for diagnosis plus implementation when the prompt separates those modes clearly.
- Good at surfacing contradictions, second-order effects, dead code, and risky edges when explicitly asked.
- For audits, add grounding and research-style evidence collection.
- For refactors, preserve behavior by default and prefer staged changes when the scope is broad.
