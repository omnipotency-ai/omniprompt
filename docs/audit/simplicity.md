# Simplicity Audit

**Date:** 2026-03-08
**Scope:** Full codebase (backend + frontend)

## Findings

### [CRITICAL] Frontend-backend model drift: Session still uses old field names

**File:** `frontend/src/pages/Workbench.tsx:243-244, 273-285`
**File:** `frontend/src/components/SessionSidebar.tsx:140-155`
**Description:** The backend Session model was rewritten to use `clarify_rounds` and `compiled_versions`, but the frontend still references `session.clarifying_questions`, `session.clarifying_answers`, `session.compile_result`, and `session.notes`. The frontend `Session` type in `types/index.ts` has the new field names (`clarify_rounds`, `compiled_versions`) but Workbench.tsx ignores them and uses old names that do not exist on the type. The `SessionSidebar` references `currentSession.notes` which is not on the new Session type at all. This is not over-engineering -- it is broken code that will fail at runtime once the backend is actually serving new-format sessions.
**Simpler alternative:** Align the frontend to the backend model. Remove all references to `clarifying_questions`, `clarifying_answers`, `compile_result`, and `notes` from Workbench.tsx and SessionSidebar.tsx.
**Effort to simplify:** Medium

### [CRITICAL] Frontend-backend model drift: Library uses `why_it_works` instead of `expected_result_assessment`

**File:** `frontend/src/pages/Workbench.tsx:539`
**File:** `frontend/src/pages/Library.tsx:58, 199`
**File:** `frontend/src/types/index.ts` (Prompt interface)
**Description:** The backend `Prompt` model was renamed from `why_it_works` to `expected_result_assessment`, and the migration script handles this rename. But the frontend `PromptCreateRequest` and `Prompt` types still use `expected_result_assessment` correctly in the type definition, yet the actual code in Workbench.tsx sends `why_it_works` (line 539) and Library.tsx reads `prompt.why_it_works` (lines 58, 199) -- a field that does not exist on the frontend Prompt type. These will either silently send the wrong field name or display `undefined`.
**Simpler alternative:** Replace `why_it_works` with `expected_result_assessment` in the three frontend files.
**Effort to simplify:** Low

### [CRITICAL] Prompt system uses stale task type `frontend_iteration` instead of `frontend`

**File:** `backend/prompts/clarifier_system.py:30`
**File:** `backend/prompts/router_system.py:24`
**File:** `backend/prompts/compiler_system.py:73, 321, 476`
**File:** `frontend/src/components/IntentInput.tsx:14`
**Description:** The `TaskType` Literal was changed to `"frontend"` (the migration script renames `frontend_iteration` to `frontend`), but all three prompt guidance dictionaries still use `"frontend_iteration"` as the key. When the clarifier, router, or compiler tries `TASK_CLARIFIER_GUIDANCE["frontend"]`, it will raise a `KeyError`. Similarly, `IntentInput.tsx` has a `TASK_HINTS` map keyed by `frontend_iteration` instead of `frontend`, and has no entry for `implement`. This means the "Frontend" and "Implement" task types are broken at the prompt layer.
**Simpler alternative:** Change the dictionary keys from `"frontend_iteration"` to `"frontend"` in all three prompt files. Add `"implement"` entries. Add an `implement` hint in IntentInput.tsx.
**Effort to simplify:** Low

### [HIGH] `on_read` callback pattern in store classes adds indirection for `ensure_storage()`

**File:** `backend/main.py:75-78, 142-143, 167-168`
**Description:** All three store classes (`ProjectRegistry`, `PromptLibraryStore`, `SessionStore`) accept an `on_read: Callable[[], None]` parameter that is always `ensure_storage`. This callback is invoked before every read and write operation. The indirection hides what the callback does and why it is called. It also calls `ensure_storage()` redundantly -- for example, `ProjectRegistry.list()` calls it on line 80, then calls it again on line 84 inside the `FileNotFoundError` handler, and `_write` calls it again on line 134.
**Simpler alternative:** Call `ensure_storage()` once at startup (which already happens on line 234-235) and remove the `on_read` callback entirely. If paranoid about directory deletion at runtime, call `ensure_storage()` directly inside the methods that need it instead of injecting it as a callback.
**Effort to simplify:** Low

### [HIGH] Session update handler's field-by-field `model_fields_set` checking

**File:** `backend/main.py:439-469`
**Description:** The `update_session` handler builds an update dict by checking `"field_name" in payload.model_fields_set` for 8 separate fields. This is verbose, error-prone (easy to forget a field), and hard to read. It exists to distinguish "the client sent `null`" from "the client didn't send this field," but the pattern is repeated identically for every field.
**Simpler alternative:** Use `payload.model_dump(exclude_unset=True)` to get only the fields the client actually sent, then merge with `existing_session.model_dump()`. Handle the two `append_*` fields separately since they have special semantics. This reduces 30 lines to roughly 8.
**Effort to simplify:** Low

### [HIGH] Duplicated `_build_client()` function across three modules

**File:** `backend/compiler.py:100-104`
**File:** `backend/clarifier.py:58-62`
**File:** `backend/router.py:79-83`
**Description:** The exact same `_build_client()` function (check env var, raise RuntimeError, return OpenAI client) is copy-pasted in three files. This is the kind of duplication that is worth extracting -- it is not a premature abstraction, it is a shared dependency with identical logic.
**Simpler alternative:** Extract to a single `backend/openai_client.py` or even just a module-level function in a shared location. Three call sites, identical code, clear single responsibility.
**Effort to simplify:** Low

### [HIGH] try/except import pattern duplicated across every backend module

**File:** `backend/main.py:15-60`
**File:** `backend/compiler.py:7-22`
**File:** `backend/clarifier.py:8-19`
**File:** `backend/router.py:8-33`
**File:** `backend/harvester.py:9-12`
**Description:** Every backend module has a `try: from backend.X ... except ModuleNotFoundError: from X ...` block. This is a workaround for running modules both as `python backend/main.py` and as `python -m backend.main`. It doubles the import section of every file and is a maintenance burden (every new import must be added in two places).
**Simpler alternative:** Pick one import style and enforce it. If the app is always run via `uvicorn backend.main:app` (which it should be for FastAPI), use absolute imports only. If direct execution is needed, add a `__main__.py` or fix `sys.path` in one place.
**Effort to simplify:** Low

### [MEDIUM] Workbench.tsx is a 907-line god component with 20+ state variables

**File:** `frontend/src/pages/Workbench.tsx`
**Description:** The component manages 20+ `useState` calls, 10+ async handler functions, workflow card derivation, session CRUD, library save, copy-to-clipboard, and the entire UI render tree. This violates the owner's stated principle of "no god components." The state management, API calls, and session lifecycle logic could be extracted into a custom hook (e.g., `useWorkbenchState`) leaving the component as pure render.
**Simpler alternative:** Extract a `useWorkbenchState()` hook containing all state, derived values, and async handlers. The component becomes a render function that destructures the hook's return value. No new abstractions needed -- just moving code.
**Effort to simplify:** Medium

### [MEDIUM] `getSessionPayload()` builds old-format payloads that don't match the backend API

**File:** `frontend/src/pages/Workbench.tsx:237-249`
**Description:** `getSessionPayload()` returns an object with `clarifying_questions`, `clarifying_answers`, and `compile_result` -- fields that exist on neither `SessionCreateRequest` nor `SessionUpdateRequest` in the backend. The backend expects `append_clarify_round` and `append_compiled_version`. This function produces payloads the backend will reject (due to `extra="forbid"` on `ApiModel`).
**Simpler alternative:** Rewrite `getSessionPayload()` to produce payloads matching the actual backend API contract.
**Effort to simplify:** Medium (requires understanding the new session update semantics)

### [MEDIUM] Effectiveness rating scale mismatch: frontend shows 1-5, backend allows 1-7

**File:** `frontend/src/pages/Workbench.tsx:868-873`
**File:** `backend/models.py:225`
**Description:** The backend `Prompt.effectiveness_rating` field uses `ge=1, le=7` (1-7 scale per owner decision), but the frontend dropdown only shows options 1-5. This is a silent data constraint that prevents users from using the full scale the backend supports.
**Simpler alternative:** Update the frontend dropdown to show 1-7 to match the backend.
**Effort to simplify:** Low

### [MEDIUM] Over-specified Pydantic validation on AI-generated content

**File:** `backend/models.py:95-97, 100, 104, 117-118, 140`
**Description:** Fields like `ClarifyingOption.label` (max_length=160), `ClarifyingQuestion.question` (max_length=400), `ClarifyingAnswer.answer` (max_length=1000), and `CompiledVersion.version_label` (max_length=16) have tight length constraints. These are AI-generated fields -- the app controls what the AI returns. If the AI occasionally returns a 401-character question, the app crashes with a validation error instead of showing the question. The constraints add fragility without protecting against a real threat.
**Simpler alternative:** Remove `max_length` from AI-generated fields. Keep `min_length=1` where emptiness is a real concern. Keep `max_length` only on user-input fields where the UI needs a hard limit.
**Effort to simplify:** Low

### [MEDIUM] `_response_hit_output_limit` uses defensive getattr chains instead of typed response

**File:** `backend/compiler.py:187-200`
**Description:** The function uses three `getattr` calls and a dict fallback to inspect the OpenAI response object. This suggests the response type is not well-understood. The OpenAI SDK has typed response objects -- `response.status` and `response.incomplete_details.reason` can be accessed directly.
**Simpler alternative:** Use the typed SDK response directly: `return response.status == "incomplete" and getattr(response.incomplete_details, "reason", None) == "max_output_tokens"`. One line instead of 14.
**Effort to simplify:** Low

### [MEDIUM] Prompt files use `"frontend_iteration"` as key but also lack `"implement"` guidance

**File:** `backend/prompts/clarifier_system.py`
**File:** `backend/prompts/router_system.py`
**File:** `backend/prompts/compiler_system.py`
**Description:** Beyond the key mismatch (covered in a CRITICAL finding), the prompt guidance dictionaries have no entries for the `"implement"` task type. Calling `get_task_clarifier_guidance("implement")` will raise a `KeyError`. This is a missing feature, not over-engineering, but it means 25% of the declared task types are unsupported by the AI layer.
**Simpler alternative:** Add `"implement"` entries to all three prompt guidance dictionaries. They can be short and prescriptive since "implement" is the simplest task type.
**Effort to simplify:** Low

### [MEDIUM] `MODEL_KNOWLEDGE_FILES` only covers 3 of 10 models

**File:** `backend/prompts/compiler_system.py:37-41`
**Description:** The compiler has model knowledge files for `gpt-5.4`, `gpt-5-mini`, and `claude-sonnet-4-6`, but the app supports 10 models. Calling `get_model_compilation_guidance()` with any other model will raise a `KeyError`. The `MODEL_COMPILATION_GUIDANCE` and `MODEL_OUTPUT_BLUEPRINTS` dicts also only cover these 3 models. This means 7 of 10 selectable models will crash the compiler.
**Simpler alternative:** Either add basic entries for all supported models, or add a fallback that returns generic guidance when model-specific guidance is missing. A `dict.get()` with a sensible default would prevent crashes.
**Effort to simplify:** Low (for fallback) / Medium (for full coverage)

### [MEDIUM] Duplicated `_render_answers()` in compiler.py and router.py

**File:** `backend/compiler.py:203-209`
**File:** `backend/router.py:122-128`
**Description:** Nearly identical helper functions. Small duplication, but since both are formatting clarifying answers for AI prompts, they could share a single implementation.
**Simpler alternative:** Move to a shared utility or into the `ClarifyingAnswer` model as a render method.
**Effort to simplify:** Low

### [LOW] Tests that validate Pydantic's own behavior

**File:** `backend/tests/test_models.py:32-39, 48-68, 77-83, 144-146, 270-284`
**Description:** Tests like `test_valid_task_types` (parameterized over all 4 valid values), `test_valid_models` (parameterized over all 10 models), `test_valid_statuses`, `test_round_number_must_be_ge_1`, and `test_rating_0_invalid` / `test_rating_8_invalid` are testing that Pydantic's `Literal`, `ge`, and `le` constraints work. These add test maintenance burden without testing business logic. The `ClarifyingQuestion` model validator tests (lines 98-129) are worthwhile since they test custom validation logic.
**Simpler alternative:** Remove pure Pydantic-constraint tests. Keep tests for custom validators (`validate_options`, `validate_has_update`, `validate_non_blank`) since those are business logic.
**Effort to simplify:** Low

### [LOW] `ProjectRegistry.list()` calls `self._on_read()` twice on FileNotFoundError path

**File:** `backend/main.py:80-84`
**Description:** `list()` calls `self._on_read()` on line 80, then calls it again on line 84 inside the `except FileNotFoundError` handler. The second call is presumably to ensure the directory exists after the file was not found, but `ensure_storage()` already creates the file with `[]` content, so the `FileNotFoundError` path should not be reachable after startup.
**Simpler alternative:** Remove the redundant `self._on_read()` call on line 84.
**Effort to simplify:** Low

### [LOW] `advisory_only: bool = True` is a constant that never varies

**File:** `backend/models.py:272`
**File:** `backend/router.py:75`
**Description:** `RouteResponse.advisory_only` is always `True` and is hardcoded in the router. It adds a field to every response that never carries information. It appears to be a "future flexibility" flag that could be added when actually needed.
**Simpler alternative:** Remove the field. If advisory-vs-mandatory routing becomes a feature, add it then.
**Effort to simplify:** Low

### [LOW] `_ClarifierPayload` and `_RouterPayload` intermediate models

**File:** `backend/clarifier.py:24-26`
**File:** `backend/router.py:38-43`
**Description:** These internal Pydantic models exist only to parse the structured output from the OpenAI API, then immediately copy their fields into a response model (`ClarifyResponse`, `RouteResponse`). The duplication between the parse model and the response model is minor, and the intermediate models are small enough that this is acceptable. Flagging only because the fields are identical and the mapping is trivial.
**Simpler alternative:** Use the response models directly as the `text_format` for `responses.parse()`, adding any extra fields with defaults. This eliminates the intermediate models entirely.
**Effort to simplify:** Low

### [LOW] CORS allows both listed origins and a regex that already covers them

**File:** `backend/main.py:219-228`
**Description:** The CORS middleware specifies 6 explicit origins AND a regex `r"https?://(localhost|127\.0\.0\.1)(:\d+)?"` that already matches all 6. The explicit list is redundant.
**Simpler alternative:** Keep only the regex. Or keep only the explicit list if the regex feels too permissive for production.
**Effort to simplify:** Low

### [LOW] `compiler_system.py` output blueprints contain massive repeated XML blocks

**File:** `backend/prompts/compiler_system.py:89-548`
**Description:** The `MODEL_OUTPUT_BLUEPRINTS` dictionary contains ~460 lines of XML template strings. Much of the content is repeated across task types (e.g., `<verification_loop>`, `<missing_context_gating>`, `<autonomy_and_persistence>` appear in all GPT-5.4 blueprints with nearly identical text). However, this is prompt engineering content, not application logic. Deduplicating it risks making the prompts harder to tune independently per task type. The repetition is the cost of keeping each blueprint self-contained and independently editable.
**Simpler alternative:** This is a judgment call. The current approach (full repetition) is valid for prompt engineering where each template may diverge. If the blocks truly never diverge, they could be composed from shared fragments. No strong recommendation to change.
**Effort to simplify:** Medium

## Summary

- 3 critical findings (frontend-backend drift on Session fields, Library field naming, and stale task type keys in prompt dictionaries)
- 5 high findings (on_read callback, field-by-field update pattern, duplicated \_build_client, try/except imports, and missing implement task type support)
- 7 medium findings (god component, payload mismatch, rating scale, over-specified validation, defensive getattr, missing model coverage, duplicated \_render_answers)
- 6 low findings (testing Pydantic internals, redundant on_read call, constant advisory_only, intermediate parse models, redundant CORS, repeated prompt blocks)

**Overall assessment:** The codebase is reasonably well-structured for a v0.1 app. The most urgent issues are the three CRITICAL findings -- the frontend and backend have diverged after the domain model rewrite, and the prompt guidance dictionaries still use old task type keys. These are not over-engineering problems; they are incomplete migration problems that will cause runtime failures. The HIGH findings are genuine simplification opportunities that would reduce maintenance burden. The MEDIUM and LOW findings are optional improvements that can be addressed as the app evolves.
