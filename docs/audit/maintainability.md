# Maintainability Audit

**Date:** 2026-03-08
**Scope:** Full codebase (backend + frontend)

## Findings

### [CRITICAL] Workbench.tsx is a god component with 907 lines and 7+ responsibilities

**File:** `frontend/src/pages/Workbench.tsx` (entire file)
**Description:** This single component owns: (1) all workflow state (15+ useState hooks), (2) session CRUD orchestration, (3) clarify/route/compile API orchestration, (4) library save logic, (5) derived workflow state computation (recommendedAction, workflowCards, nextStepCopy), (6) session hydration/dehydration (applySession, getSessionPayload), and (7) the entire page layout and rendering. Every workflow action is an inline async function that mixes API calls, state transitions, and session sync.
**Impact:** Any change to workflow logic, session handling, or layout requires editing this file. State bugs are hard to trace because 15+ hooks interact implicitly. New developers cannot understand one concern without reading all 907 lines.
**Recommendation:** Extract at minimum: (1) a `useWorkbenchState` hook owning the 15+ state variables and derived values, (2) a `useWorkbenchActions` hook (or similar) encapsulating the async handlers (handleClarify, handleCompile, handleRecommendModel, handleSavePrompt, handleStartSession, etc.), (3) a `useSessionSync` hook for session create/update/apply/close logic. The JSX can then be split into smaller layout components that receive props from the hooks.

---

### [CRITICAL] Frontend uses old domain model fields that no longer exist in the backend

**File:** `frontend/src/pages/Workbench.tsx:243-244,273,285,289,349,406-409,448,486,539`
**Description:** The Workbench still constructs payloads with old-schema field names: `clarifying_questions`, `clarifying_answers`, `compile_result`, `note_body`, and `why_it_works`. The backend models were rewritten (Phase 1) to use `clarify_rounds`, `compiled_versions`, `append_clarify_round`, `append_compiled_version`, and `expected_result_assessment`. The frontend `Session` type in `types/index.ts` correctly mirrors the new backend schema (with `clarify_rounds` and `compiled_versions`), but `Workbench.tsx` still references `session.clarifying_questions`, `session.clarifying_answers`, `session.compile_result` -- fields that do not exist on the `Session` interface.
**Impact:** The app is broken at runtime. Session creation, update, and resume will fail or silently drop data. The `getSessionPayload()` function builds objects incompatible with the backend API. The `applySession()` function reads properties that do not exist on the Session type.
**Recommendation:** Rewrite `getSessionPayload()` to produce `SessionCreateRequest`/`SessionUpdateRequest` using the new schema (`append_clarify_round`, `append_compiled_version`). Rewrite `applySession()` to read from `session.clarify_rounds` and `session.compiled_versions`. Replace `why_it_works` with `expected_result_assessment` in the save-to-library flow.

---

### [CRITICAL] Frontend Prompt type and Library page use stale field name `why_it_works`

**File:** `frontend/src/pages/Library.tsx:58,199` and `frontend/src/pages/Workbench.tsx:539`
**Description:** The `Prompt` interface in `types/index.ts` correctly has `expected_result_assessment`, but `Library.tsx` references `prompt.why_it_works` (line 58 for search filtering, line 199 for display). `Workbench.tsx:539` sends `why_it_works` in the library save payload. Neither field exists on the typed `Prompt` interface, so TypeScript should catch this -- but if types are loosened or cast, this silently produces undefined values.
**Impact:** Library search filtering is broken (searches against `undefined`). Library display shows nothing for the "Why this worked" field. Saving prompts sends the wrong field name to the backend.
**Recommendation:** Replace all `why_it_works` references with `expected_result_assessment` in `Library.tsx` and `Workbench.tsx`.

---

### [CRITICAL] SessionSidebar references `session.notes` which does not exist on the Session type

**File:** `frontend/src/components/SessionSidebar.tsx:140-155`
**Description:** The component reads `currentSession.notes` and iterates over it, expecting objects with `id`, `body`, and `created_at` fields. The `Session` interface in `types/index.ts` has no `notes` field -- it was removed in the Phase 1 domain model rewrite. The backend migration explicitly strips `notes` from session data.
**Impact:** Runtime crash or silent failure when a session is active. The "Add note" feature in the sidebar is dead code connected to a non-existent API field.
**Recommendation:** Remove the notes rendering section from `SessionSidebar.tsx`. Remove the `handleAddSessionNote` function and `note_body` payload field from `Workbench.tsx`. If session notes are still desired, add the field back to the domain model first.

---

### [HIGH] Frontend `IntentInput` uses stale `frontend_iteration` task type key

**File:** `frontend/src/components/IntentInput.tsx:13,41`
**Description:** The `TASK_HINTS` record uses `frontend_iteration` as a key, but the `TaskType` union was renamed to `"frontend"` in the domain model rewrite. The `TaskType` in `types/index.ts` is `"refactor" | "frontend" | "audit" | "implement"`. When `taskType` is `"frontend"`, `TASK_HINTS[taskType]` returns `undefined`.
**Impact:** No hint text is shown for the "Frontend" task type. The `implement` task type also has no hint entry, so it also renders `undefined`.
**Recommendation:** Rename the `frontend_iteration` key to `frontend` and add an `implement` entry in `TASK_HINTS`.

---

### [HIGH] Backend prompt guidance dictionaries use stale `frontend_iteration` key

**File:** `backend/prompts/clarifier_system.py:30`, `backend/prompts/router_system.py:24`, `backend/prompts/compiler_system.py:73,321,476`
**Description:** All three prompt modules use `"frontend_iteration"` as a dictionary key for task-specific guidance. The `TaskType` Literal was changed to `"frontend"`, and the lookup functions (`get_task_clarifier_guidance`, `get_task_routing_guidance`, `get_task_compilation_guidance`, `get_model_output_blueprint`) do bare dictionary access that will raise `KeyError` for `"frontend"`.
**Impact:** Any clarify, route, or compile request with `task_type="frontend"` will crash with a `KeyError`. The `"implement"` task type is also missing from all guidance dictionaries, so it will crash too.
**Recommendation:** Rename the `"frontend_iteration"` keys to `"frontend"` in all three prompt files. Add `"implement"` guidance entries in all three files (clarifier, router, compiler system prompts, and output blueprints).

---

### [HIGH] `_build_client()` is duplicated identically in three files

**File:** `backend/compiler.py:100-104`, `backend/clarifier.py:58-62`, `backend/router.py:79-83`
**Description:** The exact same function appears in all three AI service modules: read `OPENAI_API_KEY` from env, raise if missing, return `OpenAI(api_key=...)`. Similarly, `_render_answers()` is duplicated between `compiler.py:203-209` and `router.py:122-128`.
**Impact:** Any change to client construction (e.g., adding a timeout, switching to async, adding retry config) must be made in three places. Divergence is likely over time.
**Recommendation:** Extract `_build_client()` into a shared module (e.g., `backend/openai_client.py` or a `backend/services/base.py`). Extract `_render_answers()` into a shared formatting utility.

---

### [HIGH] `try/except ModuleNotFoundError` import pattern in every backend module

**File:** `backend/main.py:15-60`, `backend/compiler.py:7-22`, `backend/clarifier.py:8-19`, `backend/router.py:8-33`, `backend/harvester.py:9-12`
**Description:** Every backend module duplicates a try/except block that imports from `backend.X` and falls back to bare `X`. This supports running the module both as `python backend/main.py` and as `python -m backend.main`, but it doubles the import surface in every file and masks genuine import errors.
**Impact:** If a real import fails (e.g., typo in a module name), the except block silently catches it and attempts a different import, potentially producing confusing errors downstream. The pattern adds 10-20 lines of noise per file.
**Recommendation:** Standardize on one invocation method (package imports via `python -m backend.main` or an entry point). Remove the fallback imports. If both modes are truly needed, use a single conditional at the package level or configure `sys.path` once in a launcher script.

---

### [HIGH] Rating scale mismatch between backend (1-7) and frontend (1-5)

**File:** `backend/models.py:225` (`ge=1, le=7`) vs `frontend/src/pages/Workbench.tsx:868-871` (`["5","4","3","2","1"]`) and `frontend/src/pages/Library.tsx:177` (`/5`)
**Description:** The backend `Prompt.effectiveness_rating` field validates ratings from 1 to 7 (per the owner's decision to expand to a 1-7 scale). The frontend dropdown only offers values 1-5, and the Library page displays ratings as `X/5`.
**Impact:** Users can never submit ratings 6 or 7. Library display is misleading for any data that was entered via API with ratings above 5.
**Recommendation:** Update the frontend select to offer 1-7 and change the display format to `X/7`.

---

### [HIGH] No tests for backend routes, stores, or AI service modules

**File:** `backend/tests/` (only `test_models.py` and `test_migration.py` exist)
**Description:** Test coverage is limited to Pydantic model validation and data migration transforms. There are no tests for: route handlers in `main.py`, the `ProjectRegistry`/`PromptLibraryStore`/`SessionStore` classes, `compiler.py`/`clarifier.py`/`router.py` business logic, `harvester.py` file collection, or end-to-end API integration.
**Impact:** Any refactor to route handlers, store logic, or AI integration has no safety net. Regressions in session update logic (the complex `model_fields_set` merge in `update_session`) would go undetected.
**Recommendation:** Add: (1) unit tests for store classes using tmp_path fixtures, (2) integration tests for route handlers using FastAPI's TestClient, (3) unit tests for `_build_compiler_prompt`, `_normalize_compiled_prompt`, `_response_hit_output_limit` with mocked OpenAI responses. The `update_session` merge logic (lines 431-470 of `main.py`) is especially fragile and deserves dedicated tests.

---

### [HIGH] No frontend tests at all

**File:** `frontend/src/` (no test files found)
**Description:** There are zero test files in the frontend. No unit tests for utility functions (`getModelLabel`, `getDefaultModelForTask`, `deriveSessionTitle`), no component tests, no integration tests.
**Impact:** Every frontend change is tested manually only. The stale field name bugs identified above would have been caught by even basic TypeScript compilation checks or snapshot tests.
**Recommendation:** Add at minimum: (1) unit tests for `types/index.ts` utility functions, (2) component render tests for leaf components (CompiledOutput, IntentInput, ProjectSelector), (3) integration tests for the Workbench workflow using React Testing Library.

---

### [MEDIUM] `main.py` mixes route handlers, store classes, and utility functions in one file

**File:** `backend/main.py` (580 lines)
**Description:** This file contains three store classes (`ProjectRegistry`, `PromptLibraryStore`, `SessionStore`), all route handler definitions (nested inside `create_app()`), module-level path constants, storage initialization, and multiple utility functions (`_read_model_file`, `_write_json_file`, `_derive_session_title`, `_resolve_directory`, `_load_repo_map`, `_to_ai_http_exception`, `_utc_now`).
**Impact:** While not yet a god file at 580 lines, it is trending that way. Adding new routes, stores, or utilities will push it past the threshold. The nested route handler pattern makes testing harder (handlers cannot be imported independently).
**Recommendation:** Extract stores into `backend/stores.py` (or a `stores/` package). Extract route definitions into a FastAPI router module using `APIRouter`. Keep `main.py` as the app factory that wires everything together.

---

### [MEDIUM] `compiler_system.py` is 598 lines of string constants with structural repetition

**File:** `backend/prompts/compiler_system.py` (entire file)
**Description:** The file contains massive multi-line string literals for model output blueprints. The GPT-5.4 blueprints for refactor, audit, and frontend_iteration share 12+ identical XML blocks (reasoning_effort, output_contract, verbosity_controls, default_follow_through_policy, instruction_priority, tool_persistence_rules, dependency_checks, parallel_tool_calling, completeness_contract, empty_result_recovery, verification_loop, missing_context_gating, action_safety, autonomy_and_persistence, user_updates_spec, terminal_tool_hygiene). These blocks are copy-pasted with only minor wording differences.
**Impact:** Updating a shared control block (e.g., changing verification_loop wording) requires editing it in 3+ places. Drift between copies is inevitable.
**Recommendation:** Extract shared XML blocks into named constants or a builder function that assembles the blueprint from shared + task-specific sections.

---

### [MEDIUM] `_read_model_file` has an overly narrow type union

**File:** `backend/main.py:484`
**Description:** The function signature is `def _read_model_file(path: Path, model_type: type[Project] | type[Prompt] | type[Session] | type[RepoMap])`. This hardcodes every model type into the signature and must be updated whenever a new model is added.
**Impact:** Minor friction when adding new models. The function's actual logic is fully generic (it just calls `model_type.model_validate`), so the type restriction adds no safety.
**Recommendation:** Use a TypeVar bound to `BaseModel` (or `ApiModel`) to make the function generic: `T = TypeVar('T', bound=BaseModel)` and `def _read_model_file(path: Path, model_type: type[T]) -> T`.

---

### [MEDIUM] `ensure_storage()` is called on every store read operation

**File:** `backend/main.py:74-81` (ProjectRegistry), `142-147` (PromptLibraryStore), `166-170` (SessionStore)
**Description:** Every store class takes an `on_read: Callable[[], None]` parameter and calls it at the start of every `list()`, `get()`, `create()`, `update()`, and `_write()` method. This callback is `ensure_storage`, which calls `mkdir(parents=True, exist_ok=True)` on four directories and checks if `projects.json` exists on every single API request.
**Impact:** Unnecessary filesystem syscalls on every request. The `on_read` naming is misleading since it is also called on writes. The redundant `self._on_read()` call in `ProjectRegistry.list()` at line 80 is called, and then called again at line 84 inside the `FileNotFoundError` except block.
**Recommendation:** Call `ensure_storage()` once at startup (which is already done in the `startup` event). Remove the `on_read` callback from store constructors. If paranoid about directory deletion during runtime, add a health check endpoint instead.

---

### [MEDIUM] CORS origins are hardcoded with redundant regex

**File:** `backend/main.py:218-228`
**Description:** Six explicit origins are listed in `allow_origins`, and then `allow_origin_regex` is set to a pattern that already covers all of them (`r"https?://(localhost|127\.0\.0\.1)(:\d+)?"`). The explicit list is entirely redundant.
**Impact:** Maintenance confusion. Developers may add new ports to the explicit list without realizing the regex already covers them, or vice versa.
**Recommendation:** Keep only the regex (for development) and make origins configurable via environment variable for production.

---

### [MEDIUM] `MODEL_KNOWLEDGE_FILES` only covers 3 of 10 models

**File:** `backend/prompts/compiler_system.py:37-41`
**Description:** The `MODEL_KNOWLEDGE_FILES` dict and `MODEL_COMPILATION_GUIDANCE` dict only have entries for `gpt-5.4`, `gpt-5-mini`, and `claude-sonnet-4-6`. The `ModelChoice` Literal includes 10 models. Calling `get_model_compilation_guidance()` or `get_model_output_blueprint()` with any of the 7 missing models will raise a `KeyError`.
**Impact:** Compiling a prompt targeted at `claude-opus-4-6`, `claude-haiku-4-5`, `gemini-3.0-flash`, `gemini-3.0-pro`, `gpt-4.1`, `kimi-k2.5`, or `minimax-m2.5` will crash the compiler.
**Recommendation:** Either add guidance entries for all 10 models, or add a sensible fallback (e.g., use `gpt-5-mini`'s guidance as a generic default for unsupported models). At minimum, the lookup should not crash.

---

### [MEDIUM] Router system prompt only allows 3 models but `ModelChoice` has 10

**File:** `backend/prompts/router_system.py:34-36` and `backend/router.py:38-43`
**Description:** The router system prompt instructs the AI to "Choose between these models only: gpt-5.4, claude-sonnet-4-6, gpt-5-mini", and the `_RouterPayload` schema constrains `recommended_model` to `ModelChoice` (all 10). The routing guidance also only mentions these 3 models. The AI will recommend from the full 10-model set per the schema, but the system prompt says only 3 are allowed.
**Impact:** The router may recommend models it has no guidance for, or the AI may be confused by the contradictory instructions. The routing guidance for each task type only discusses 3 models.
**Recommendation:** Either expand the router system prompt and guidance to cover all 10 models, or constrain `_RouterPayload.recommended_model` to a 3-model subset. Make this an intentional, documented decision.

---

### [LOW] `_response_hit_output_limit` uses `getattr` instead of typed response

**File:** `backend/compiler.py:187-200`
**Description:** The function checks `response.status` and `response.incomplete_details.reason` using `getattr` with fallbacks, treating the response as `object`. This suggests the OpenAI SDK's response type is not being used.
**Impact:** No IDE autocompletion or type checking for the response object. If the OpenAI SDK changes field names, this will silently return `False` instead of raising an error.
**Recommendation:** Type the response parameter with the actual OpenAI response type, or at least document why dynamic access is needed.

---

### [LOW] Redundant double `self._on_read()` call in `ProjectRegistry.list()`

**File:** `backend/main.py:80,84`
**Description:** `self._on_read()` is called at line 80 (start of method), and then called again at line 84 inside the `FileNotFoundError` except block. The second call is unnecessary since the first already ran.
**Impact:** Extra filesystem syscall on the cold-start path. Minor but indicates copy-paste without review.
**Recommendation:** Remove the second `self._on_read()` call at line 84.

---

### [LOW] `effectiveness_rating` dropdown uses string values then casts to Number

**File:** `frontend/src/pages/Workbench.tsx:78,868-871,541`
**Description:** `effectivenessRating` state is stored as a string (`useState("5")`), rendered as `<option value="5">`, then converted via `Number(effectivenessRating)` when sending to the API. This is a string-number roundtrip that could be avoided.
**Impact:** Minor type confusion. If the string is ever empty or non-numeric, `Number()` returns `NaN` which would fail backend validation.
**Recommendation:** Store the rating as a number from the start and parse `parseInt` only in the onChange handler.

---

### [LOW] Background gradient is defined in both CSS and JSX

**File:** `frontend/src/styles.css:35-38` (body background) and `frontend/src/App.tsx:48` (inline className)
**Description:** The radial/linear gradient background is defined in the body CSS and also applied as an inline Tailwind class on the root div in `App.tsx`. The values are similar but not identical (CSS uses `0.12` opacity, JSX uses `0.16`).
**Impact:** Confusing for developers. The JSX gradient overrides the CSS one, making the CSS definition dead code. The slight opacity difference suggests unintentional drift.
**Recommendation:** Define the background in one place only (CSS or Tailwind config).

---

### [LOW] Dead default export pattern alongside named export

**File:** `frontend/src/components/ProjectSelector.tsx:86`, `IntentInput.tsx:51`, `ClarifyingQuestions.tsx:166`, `CompiledOutput.tsx:61`, `SessionSidebar.tsx:205`, `ModelSelector.tsx:83`, `Workbench.tsx:906`, `Library.tsx:220`
**Description:** Every component file exports both a named function (`export function X`) and a default export (`export default X`). All imports in the codebase use named imports.
**Impact:** The default exports are unused dead code. They create ambiguity about which import style to use.
**Recommendation:** Remove the default exports and standardize on named imports throughout.

## Summary

- 4 critical findings (frontend-backend schema mismatch across 4 areas -- the frontend has not been updated to match the Phase 1 domain model rewrite)
- 7 high findings (stale task type keys in prompts, duplicated code, missing test coverage, rating scale mismatch, import pattern noise)
- 6 medium findings (main.py separation of concerns, prompt string duplication, redundant storage checks, CORS redundancy, model coverage gaps)
- 5 low findings (minor type issues, dead code, duplicated styles)

The most urgent work is reconciling the frontend with the backend's Phase 1 domain model changes. The four CRITICAL findings all stem from the same root cause: the backend models were rewritten but the frontend was not updated. Until these are fixed, the application cannot function correctly at runtime. The HIGH-severity prompt guidance key mismatches (`frontend_iteration` and missing `implement`) will cause server crashes for two of the four task types.
