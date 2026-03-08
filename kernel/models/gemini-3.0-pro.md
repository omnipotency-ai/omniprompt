# Gemini 3.0 Pro

## Role

Google's flagship reasoning model with an exceptionally large context window, best for tasks requiring analysis across large codebases, long documents, or multimodal inputs.

## Best fit

- large codebase analysis and cross-file reasoning (up to 1M token context)
- long-document comprehension and synthesis
- multimodal tasks combining code, images, and text
- broad audits across many files where the full picture needs to fit in context
- tasks where context window size is the binding constraint

## Prompting guidance

- Take advantage of the long context window: include full files rather than snippets when cross-file reasoning matters.
- Use clear section headers and structured formatting to help the model navigate large contexts.
- For code analysis, provide the full relevant files rather than summarizing — Pro handles the volume well.
- Use explicit output contracts and verification steps, same as for other flagship models.
- For multimodal tasks, provide images inline with relevant textual context.
- Be explicit about what to focus on when providing large contexts — even with a big window, attention guidance helps.
- Use structured output mode when you need consistent JSON or schema-conforming responses.

## Strengths

- Massive context window (up to 1M tokens) — can ingest entire codebases or long documents in a single pass.
- Strong code analysis and reasoning across many files simultaneously.
- Good multimodal capabilities: can reason about code, diagrams, screenshots, and text together.
- Supports structured output for consistent formatting.
- Strong at tasks that require connecting information scattered across a large input.

## Known limitations

- Response latency can be high when processing very large contexts.
- For small, bounded tasks, the large context window provides no advantage and slower models waste time.
- Less battle-tested for agentic coding workflows compared to Claude and GPT families.
- Prompting conventions differ from OpenAI and Anthropic — avoid XML tags, prefer Markdown structure and clear section headers.
- May need more explicit grounding instructions than GPT-5.4 for ambiguity-heavy tasks.

## Compiler notes

- Bias toward Gemini 3.0 Pro when the task requires reasoning across a very large context that wouldn't fit in other models' windows.
- Bias toward GPT-5.4 or Claude Opus 4.6 instead for deep synthesis and ambiguity resolution where context size isn't the bottleneck.
- Bias toward Gemini 3.0 Flash instead for routine tasks where speed and cost matter more than reasoning depth.
- Use Markdown structure with clear headers rather than XML tags.
- When compiling prompts for Gemini, include full file contents rather than summaries when cross-file reasoning is needed.
- Add explicit focus instructions when the context is large to prevent attention dilution.
