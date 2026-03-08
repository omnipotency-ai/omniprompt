# Prompt OS Philosophy

Prompt OS separates two different roles:

1. Compiler model

The model used inside Prompt OS to clarify rough intent, reason about tradeoffs, and compile a final prompt artifact. In the current MVP, the heavy reasoning path is centered on `gpt-5.4`.

2. Audience model

The model the generated prompt is written for. This is the meaning of "multi-model" in Prompt OS. A future audience model can be added one at a time without changing the product's core flow.

The clarifying step is part of the product, not a pre-processing detail. The goal is not to obediently rewrite the user's first thought. The goal is to surface contradictions, hidden assumptions, collateral damage, dead-code fallout, and tradeoffs before tokens are spent on implementation work.

## Model Addition Checklist

When adding one new audience model:

1. Add a knowledge file in `kernel/models/<model-id>.md`.
2. Add the model id to the backend target-model union in `backend/models.py`.
3. Add the model id and label to the frontend type and option list in `frontend/src/types/index.ts`.
4. Add routing guidance for when to recommend the new model in `backend/prompts/router_system.py`.
5. Add or adjust the compiler blueprint for each supported task type in `backend/prompts/compiler_system.py`.
6. Run the compiler smoke tests and confirm the generated prompt contains the right model-specific sections.

Keep the compiler model and the audience model conceptually separate. Prompt OS may use one strong model to think, but still generate prompts tailored to many different downstream models.
