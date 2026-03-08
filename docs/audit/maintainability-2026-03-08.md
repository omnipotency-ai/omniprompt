# Maintainability Audit — Phase 3 / e2e-flows PR

**Date:** 2026-03-08
**Reviewer:** Claude Code (automated audit)
**Scope:** All files changed in the `phase3/e2e-flows` branch

---

## 1. Summary

The PR delivers three distinct things — the `/api/reformulate` endpoint and backend module, autosave + session-restore wiring in the Workbench, and the first two Playwright E2E test files — and on balance it does so cleanly. The code is well-structured and borrows established patterns from the codebase. The most important concern is a semantic divergence in `deriveVersionLabel` whose versioning scheme is already known to be superseded by the Phase 4 design document included in this very PR; leaving it in place risks growing UI code around a scheme that will be thrown away. Secondary concerns are a weak type assertion on the API response return type, a silent autosave catch block that can mask data-loss failures, and mock project fixtures in the E2E tests that omit required fields the backend schema enforces.

---

## 2. Findings

---

### F-01 — `deriveVersionLabel` implements a versioning scheme that contradicts the Phase 4 design included in this same PR

**Severity: High**

**File:** `frontend/src/pages/Workbench.tsx`, lines 92–112

**Description:**
`deriveVersionLabel` uses the scheme `1.0`, `1.01`, `1.02` (major = compile-count, decimal = iteration). The `docs/phase4-design.md` document added in this same PR defines a completely different scheme: `{session_number}.{version_path}` where the version_path is a digit string encoding tree depth (e.g. `7.021`). The two schemes are incompatible. Because the function drives what is persisted in `CompiledVersion.version_label` and sent to the backend, any data written by Phase 3 code will require a migration or be misleading when Phase 4 lands. The pattern for detecting "fresh compile" (`/^\d+\.0$/.test(v.version_label)`) will produce false matches under the new scheme (`.0` only exists as the raw intent sentinel, never as a stored compiled version).

**Recommendation:**
If Phase 4 is imminent, add a `// TODO(phase4): replace with session-scoped versioning per docs/phase4-design.md` comment and file a tracking issue so the debt is explicit. If Phase 4 is further away, reconsider whether `deriveVersionLabel` should live in `Workbench.tsx` at all — extract to `src/lib/versions.ts` so that the replacement is a single-file swap.

---

### F-02 — `autosaveSession` silently swallows all errors — including session creation failures that lose the session ID

**Severity: High**

**File:** `frontend/src/pages/Workbench.tsx`, lines 335–358

**Description:**
The `catch` block in `autosaveSession` is completely empty:

```typescript
} catch {
  // Autosave failures are non-blocking
}
```

On the `createSession` path (first call before `sessionId` is set), a failure leaves `sessionId` as `null`. Every subsequent autosave then calls `createSession` again (because `sessionId` is still null), and every subsequent call also fails silently. If the backend is unreachable at session start, the user works through the entire flow believing they have a session, but nothing is persisted. The draft-restore feature then does not trigger on the next visit. This is a silent data-loss path. The "non-blocking" comment is appropriate for update-autosave failures, but not for the first-time create failure.

**Recommendation:**
Distinguish the two code paths. Surface a non-blocking toast or status indicator on repeated failure (e.g. after 3 failed attempts). At minimum, use `console.warn` so failures are visible in development.

---

### F-03 — `return payload as T` is an unchecked cast — any malformed API response silently accepts the wrong shape

**Severity: Medium**

**File:** `frontend/src/api/client.ts`, line 74

**Description:**

```typescript
return payload as T;
```

`payload` is the raw result of `response.json()`, typed as `unknown` at the JSON parse boundary but cast to `T` without any runtime validation. If the backend returns an unexpected shape (a different version, a partial write, or a 200 with an error envelope), the caller receives a silently wrong type. The `T` parameter is provided only by the caller, so TypeScript's static checking does not validate the actual JSON.

**Recommendation:**
This is a known pattern tradeoff (adding Zod or a custom validator to every endpoint is significant scope). For now the risk is acceptable given the controlled backend, but the cast should be explicitly documented: `return payload as T; // TODO: validate shape with Zod in phase 4`. If any endpoint returns nullable (`Session | null` via `getLatestSession`), verify the cast handles the `null` case correctly — it does here since `null` satisfies `T = Session | null`.

---

### F-04 — `mockSessionWithModel` in `restore-banner.spec.ts` advances to "model" stage but this path is never asserted

**Severity: Medium**

**File:** `frontend/e2e/restore-banner.spec.ts`, lines 7–20 and test at line 109

**Description:**
`mockSessionWithModel` has `selected_model: "claude-sonnet-4-6"` and zero compiled versions. According to the restore logic in `handleRestoreSession` (Workbench.tsx lines 610–618), this advances `currentStage` to `"model"`. However, the test "restore banner appears when an open session exists" uses `mockSessionWithModel` but never asserts that the model stage is active. The test "resume button restores session and advances to intent stage" uses the other fixture (`mockSessionIntentOnly`). This means the "restore advances to model" code path is never exercised by a dedicated assertion — the session-with-model fixture is used only to check that the banner appears, not what happens when Resume is clicked.

**Recommendation:**
Add a test: resume with `mockSessionWithModel` → click Resume → assert model stage content is visible (e.g. the model picker or recommendation panel). This closes the gap in restore-logic coverage and gives a safety net for the `selected_model` branch.

---

### F-05 — E2E mock project fixtures omit required fields that the real API always returns

**Severity: Medium**

**File:** `frontend/e2e/workbench.spec.ts`, lines 13–23; `frontend/e2e/restore-banner.spec.ts`, lines 43–55

**Description:**
Both test files mock the `/api/projects` response with project objects that omit `repo_map_path`, `updated_at`, and `last_mapped_at` — fields that are present (some nullable) in the `Project` TypeScript interface. The mock data also includes `description: null` which is not in the `Project` interface at all. While the frontend currently only reads `id`, `name`, and `path` from the project in the tested flows, the inconsistency means:

1. If `Project` type usage widens, tests will pass against stale mock shapes while the real app breaks.
2. `description` is extra noise that implies a now-removed or never-existed field.

**Recommendation:**
Extract a `mockProject` constant that exactly mirrors the `Project` interface (all required fields, nullable fields set to `null`), and remove `description`. Centralise it in a `frontend/e2e/fixtures.ts` file so both spec files import the same baseline.

---

### F-06 — `handleIntentContinue` sets `busyAction` twice and calls `handleClarifyRequest()` which also sets it

**Severity: Medium**

**File:** `frontend/src/pages/Workbench.tsx`, lines 395–401

**Description:**

```typescript
function handleIntentContinue() {
  void autosaveSession();
  goToStage("clarify");
  setBusyAction("clarify"); // set here
  void handleClarifyRequest(); // also sets busyAction("clarify") at line 411
}
```

`handleClarifyRequest` unconditionally sets `setBusyAction("clarify")` at its first line. This means the busy state is set twice per invocation — a redundant but harmless double-write today. However, it creates a subtle coupling: if someone edits `handleClarifyRequest` to not set busy (because they assume the caller already did), they break the standalone use (e.g. `handleClarifyAnotherRound` calls `handleClarifyRequest` directly without pre-setting busy). This is a latent inconsistency.

**Recommendation:**
Remove `setBusyAction("clarify")` from `handleIntentContinue` and rely solely on `handleClarifyRequest` to manage its own busy state. Same applies to `handleIntentSkipToModel` / `handleRouteRequest` (lines 406–408).

---

### F-07 — `_build_reformulator_prompt` embeds instruction text as a string literal rather than using the system prompt module

**Severity: Low**

**File:** `backend/reformulator.py`, lines 49–68

**Description:**
The function `_build_reformulator_prompt` contains inline instruction text ("Reformulate this rough software intent..."), while the module-level guidance lives in `REFORMULATOR_SYSTEM_PROMPT`. The codebase convention (see clarifier, compiler, router) is that all fixed model instructions belong in `backend/prompts/`. The reformulator partially follows this: the `instructions` parameter receives `REFORMULATOR_SYSTEM_PROMPT`. But the `input` prompt also contains a fixed instruction sentence: `"Reformulate this rough software intent into clear, structured prose."`. This mixes instruction text into the user-data builder, making the full directive hard to read in one place.

**Recommendation:**
Move the preamble sentence (`"Reformulate this rough software intent into clear, structured prose."`) into `REFORMULATOR_SYSTEM_PROMPT` or remove it (it is a summary of what the system prompt already says). The `_build_reformulator_prompt` function should only assemble dynamic content.

---

### F-08 — `REFORMULATOR_MODEL` is a bare string constant with no validation or shared registry

**Severity: Low**

**File:** `backend/reformulator.py`, line 14

**Description:**

```python
REFORMULATOR_MODEL = "gpt-5.4"
```

`"gpt-5.4"` is a valid value of `ModelChoice` (the Literal type in `models.py`), but `REFORMULATOR_MODEL` is typed as `str`, not `ModelChoice`. If the model ID changes in `ModelChoice` (e.g. renamed), this constant silently drifts. The existing `clarifier.py` and `compiler.py` have the same pattern, so this is a codebase-wide issue rather than a regression introduced by this PR — but the PR adds a new instance of it.

**Recommendation:**
Type `REFORMULATOR_MODEL` as `ModelChoice` (import it from `models`). This catches renames at type-check time. Consider a shared `DEFAULT_AI_MODEL: ModelChoice = "gpt-5.4"` constant in `openai_client.py` or a new `backend/constants.py` if it makes sense to unify across all AI modules.

---

### F-09 — `getattr(response, "output_parsed", None)` weakens the trust boundary with the OpenAI client

**Severity: Low**

**File:** `backend/reformulator.py`, line 39

**Description:**

```python
parsed = getattr(response, "output_parsed", None)
```

Using `getattr` with a default suppresses `AttributeError` — it is a defensive pattern appropriate when the attribute is known to be occasionally absent (e.g. different response types). Here, since `client.responses.parse` is supposed to return a response object with `output_parsed`, the `getattr` hides what should be a hard error (wrong return type). The existing pattern in `clarifier.py` and `compiler.py` likely uses the same approach (this is a cross-codebase pattern), but it means type errors in the SDK integration silently produce the "no structured output" `RuntimeError` rather than a more specific error.

**Recommendation:**
This is low risk in practice but consider adding `assert isinstance(parsed, _ReformulatorPayload)` after the `getattr` to ensure the parsed object is the expected type before accessing `.reformulated_intent`.

---

### F-10 — `SessionUpdateRequest.validate_has_update` validator is bypassed when `autosaveSession` provides only `status: "open"` and `selected_model`

**Severity: Low**

**File:** `backend/models.py`, lines 188–205; `frontend/src/pages/Workbench.tsx`, lines 338–344

**Description:**
The `validate_has_update` validator checks that at least one field is non-None. The `autosaveSession` always provides `task_type` and `status`, so the validator always passes. This is correct. However, the validator's `all(... is None ...)` check includes `status` but `SessionUpdateRequest.status` is typed as `SessionStatus | None` (not `SessionStatus`). Sending `status: None` explicitly would fail the "at least one change" guard via the validator, which is correct behaviour. No bug here, but worth noting the field's optionality is inconsistent with how `autosaveSession` always supplies it.

**Recommendation:**
No code change required. Info only.

---

### F-11 — `route_result` field in mock session objects is absent in both E2E fixtures

**Severity: Info**

**File:** `frontend/e2e/workbench.spec.ts` (all mock sessions); `frontend/e2e/restore-banner.spec.ts` (all mock sessions)

**Description:**
The `Session` TypeScript type includes `route_result: RouteResponse | null`. Both E2E fixtures omit this field entirely. Browsers and TypeScript both tolerate missing optional-nullable fields on JSON objects, but if any code does a truthiness check on `session.route_result` after restore, the absent field (rather than explicit `null`) would behave identically in JavaScript — no observable bug. Noted for completeness.

**Recommendation:**
Add `route_result: null` to mock session objects alongside the other nullable fields for structural accuracy.

---

## 3. Strengths

**Backend module structure is textbook.** `reformulator.py` follows the same shape as `clarifier.py`, `compiler.py`, and `router.py`: a single public function, a private prompt builder, a private Pydantic inner model, a module-level model constant, and a system prompt in `backend/prompts/`. The pattern is consistent and easy to follow.

**Error handling at the endpoint boundary is robust.** `_to_ai_http_exception` correctly redacts API key strings from error messages before returning them, and the reformulate endpoint correctly maps `RuntimeError` to HTTP 502. The `/api/reformulate` tests for the 503 (auth) and 502 (generic) paths are present in spirit (covered by `test_propagates_runtime_error_as_502`).

**Backend tests test behaviour, not implementation detail.** `TestReformulateRaisesOnClientFailure`, `TestReformulateRaisesOnMissingStructuredOutput`, and `TestReformulateReturnsResponse` each have a single, clearly named test with a precise assertion. The endpoint tests cover the four most important paths: success, empty intent, invalid task type, and upstream error propagation. Using `patch.object(reformulator_mod, "get_client", ...)` is the correct injection point — it patches the reference the module holds, not the shared `get_client` definition.

**`handleRestoreSession` is deterministic and has explicit priority ordering.** The cascade (`compiled_versions` → `selected_model` → `clarify_rounds` → `rough_intent` → `context`) is a readable if-elif chain documented in the agent memory file. The E2E restore-banner tests exercise two distinct branches of that cascade.

**`autosaveSession` override spread pattern is clean.** The `...overrides` spread at the end of the payload allows callers to provide extra fields without the function needing to know about them in advance. This keeps the function stable as new session fields are added.

**`deriveLibraryTitle` correctly avoids splitting on empty strings.** The `intent.split(/[.!?]/)[0]` pattern returns `[""]` for an empty string; the `.trim()` + `slice(0, 80)` chain on the empty string is harmless. The fallback to `getTaskLabel(taskType)` is correct.

**Playwright configuration is sane for a local tool.** `fullyParallel: false`, `workers: 1`, Chromium-only, no `webServer` requiring the server to be pre-started — these are appropriate defaults for a personal workbench. The `exact: true` selector for the Library nav button prevents false matches against the "Save to library" stage label; this is correctly documented in the agent memory file.

---

## 4. Verdict

**PASS WITH NOTES**

The PR is structurally sound and follows established patterns. No finding is a blocker in isolation. The two High-severity items — the version-scheme divergence (F-01) and the silent create-failure in autosave (F-02) — should be addressed before Phase 4 work begins, as F-01 will otherwise cause a painful migration and F-02 can cause confusing user experiences if the backend is unreachable at session start. The Medium findings (F-04, F-05, F-06) are straightforward fixes. The Low and Info findings are noted for completeness and should be addressed opportunistically.
