# Simplicity Audit — phase3/e2e-flows

**Date:** 2026-03-08
**Reviewer:** Claude (code simplicity audit)
**Scope:** All files changed in the phase3/e2e-flows PR

---

## 1. Summary

The PR is mostly well-targeted. The new feature work (reformulator, autosave, draft restore) is proportionate to the spec, and the Playwright scaffolding is appropriate for a personal tool. However, three specific issues stand out: `ProjectRegistry` is a class where a handful of module-level functions would do; the `update_session` patch logic in `main.py` is 30 lines of manual field-by-field merge that could be cut in half; and `workbench.spec.ts` contains a duplicated setup that obscures what individual tests are actually asserting. Nothing here is alarming, but it nudges toward unnecessary formalism.

---

## 2. Findings

---

### F1 — `ProjectRegistry` class is a class for no reason

**Severity: Medium**
**File:** `backend/main.py` lines 82–145

`ProjectRegistry` has no state beyond `_registry_path` and `_on_read`, both of which are constants known at module load time. It is instantiated exactly once (`create_app()` line 220) and never mocked, subclassed, or swapped. The class exists to wrap five functions with two implicit arguments. There is no polymorphism, no interface, no reason for `self`.

The same is true of `PromptLibraryStore` (lines 148–170) and `SessionStore` (lines 173–216). All three classes are one-time-instantiated value containers that add the visual ceremony of OOP without any of its benefits.

**Suggested simplification:** Replace all three with module-level functions that accept `path` as an explicit argument, or inline them into the route handlers (they are already thin). At minimum, drop the class wrappers and write:

```python
def list_projects(registry_path: Path) -> list[Project]: ...
def get_project(registry_path: Path, project_id: str) -> Project | None: ...
```

The `on_read` callback (which just calls `ensure_storage()`) can be called directly in any function that does I/O. It does not need to travel through the class.

---

### F2 — `_on_read` callback passed to constructors is unnecessary indirection

**Severity: Medium**
**File:** `backend/main.py` lines 83, 149, 174 (constructors); called at lines 88, 154, 159, 178, 187, 197, 206 (within class methods)

Every store method calls `self._on_read()` before doing any I/O. `_on_read` is always `ensure_storage`. This is a one-liner that creates directories if they don't exist. The startup event already calls `ensure_storage()` (line 241), making the per-call invocations defensive no-ops in normal operation.

Passing a callable to a constructor so you can call it on every read/write is the dependency-injection pattern applied to a function that takes no arguments and has no test doubles. In a personal local tool with a startup hook already in place, this is pure ceremony.

**Suggested simplification:** Call `ensure_storage()` in the startup hook and remove the `on_read` parameter and all `self._on_read()` calls from the store classes. If you ever need lazy init, call it once at the top of `create_app()`.

---

### F3 — `update_session` patch logic is 30 lines of manual field merge

**Severity: Medium**
**File:** `backend/main.py` lines 458–488

The session update builds a dict by repeating the same ternary 8 times:

```python
"field": payload.field if "field" in payload.model_fields_set else existing_session.field,
```

This pattern is correct but verbose. For 8 fields it produces 16 branches in the dict literal, and adding a new session field requires remembering to add it here too (a maintenance trap).

**Suggested simplification:** Build a dict of only the explicitly-set fields and merge it onto the existing session:

```python
overrides = {
    k: getattr(payload, k)
    for k in payload.model_fields_set
    if k not in ("append_clarify_round", "append_compiled_version")
}
overrides["clarify_rounds"] = clarify_rounds
overrides["compiled_versions"] = compiled_versions
overrides["updated_at"] = _utc_now()
updated_session = existing_session.model_copy(update=overrides)
```

This is ~8 lines instead of 30 and does not need updating when fields are added.

---

### F4 — `_build_reformulator_prompt` is a private function called once, at one call site

**Severity: Low**
**File:** `backend/reformulator.py` lines 49–68

`_build_reformulator_prompt` is extracted into its own named function but is called exactly once, at line 31. The body is 13 lines including blanks. It does one thing: string interpolation. The extraction adds a name to look up, a signature to read, and a place to navigate to — none of which pay off when the function is used in only one place and is trivial to read inline.

**Suggested simplification:** Inline the `\n".join([...])` block directly into the `reformulate()` call, or assign it to a local `prompt` variable. Save the function extraction for when there is a second call site or the block exceeds ~20 meaningful lines.

---

### F5 — `iterateFromVersionLabel` state is a workaround for a state-staleness problem that could be avoided

**Severity: Low**
**File:** `frontend/src/pages/Workbench.tsx` lines 156–158, 486–491, 521

`iterateFromVersionLabel` is a piece of state whose sole purpose is to communicate a label to `handleCompileRequest`, but because `setIterateFromVersionLabel` is async (batched), passing the label as a direct argument was chosen instead (see the comment at line 489–490). The state then sits as a permanent residual `null` after every compile (line 521), and is never read by the "Iterate from this" button path (line 812) since that button passes the label directly.

The comment at line 489 correctly explains why the parameter takes priority, which means the state is vestigial — present but bypassed whenever it would actually matter.

**Suggested simplification:** Remove `iterateFromVersionLabel` state entirely. The `handleCompileRequest(baseLabel?: string)` signature is sufficient — callers already pass the label explicitly. The `iterateFromVersionLabel` state, `setIterateFromVersionLabel`, and its reset on line 521 can all be deleted.

---

### F6 — `autosaveSession` takes an `overrides` spread of `Record<string, unknown>` — too permissive for a known shape

**Severity: Low**
**File:** `frontend/src/pages/Workbench.tsx` lines 335–358

`autosaveSession` accepts `overrides?: Record<string, unknown>` and spreads it into the session payload. The call sites pass things like `{ reformulated_intent: ..., route_result: ..., append_clarify_round: ... }`. Because the type is `Record<string, unknown>`, there is no type-checking on override keys or values — a typo silently becomes a no-op.

**Suggested simplification:** Type `overrides` as `Partial<SessionUpdateRequest>` (or a compatible explicit type). This costs one import and provides a type error on invalid keys.

---

### F7 — `deriveSessionTitle` is duplicated between backend and frontend

**Severity: Info**
**Files:** `backend/main.py` lines 521–527 and `frontend/src/pages/Workbench.tsx` lines 74–81

Both implement the same logic: take the first 160 characters of `rough_intent`, fall back to a humanised task type, fall back to "Untitled session". The frontend version additionally normalises whitespace. The duplication is benign for a single-user local tool (there is no shared code layer), but worth noting: the backend derives the title on session create, and the frontend also derives it locally for the autosave payload — so they can diverge.

No action required, but the backend version could simply trust the frontend-provided title instead of re-deriving it.

---

### F8 — `workbench.spec.ts` duplicates route mocks between `beforeEach` and individual tests

**Severity: Low**
**File:** `frontend/e2e/workbench.spec.ts` lines 7–85 and 136–155, 158–168

The `beforeEach` block at lines 7–85 sets up four mock routes. Two tests (`navigation switches to library page` and `navigation returns to workbench from library`) then additionally mock `/api/library` (lines 138–143, 159–164) because they navigate there. This is fine, but both tests repeat the library mock setup identically — it should be a shared helper or the library mock could be added to `beforeEach` for all tests (it only fires if the user navigates to Library).

Separately, the session mock at lines 35–62 dispatches on HTTP method (`POST` vs everything else) inline. This is acceptable but the POST response body differs from the wildcard `sessions/**` mock body (different `rough_intent` value: `null` vs `"test intent"`). The inconsistency is harmless but could confuse future test authors.

**Suggested simplification:** Extract the library route mock into a helper function shared by both tests. Align the session POST mock body with the wildcard mock body unless they are intentionally different.

---

### F9 — `mockCommonRoutes` in `restore-banner.spec.ts` returns a `Promise.all` of `page.route()` calls, but `page.route()` is synchronous

**Severity: Low**
**File:** `frontend/e2e/restore-banner.spec.ts` lines 38–90

`page.route()` in Playwright is synchronous and returns `void`, not a `Promise`. Wrapping all calls in `Promise.all` and `await`-ing the result is harmless (resolved promises resolve immediately) but misleading — it implies async coordination where none exists.

**Suggested simplification:** Call `page.route()` calls sequentially without `Promise.all`. Remove the `return Promise.all([...])` wrapper and just call each in sequence.

---

### F10 — `SessionSection` in `App.tsx` is a collapsed section with no content when closed, wrapping a static label

**Severity: Info**
**File:** `frontend/src/App.tsx` lines 136–169

`SessionSection` is an extracted component with its own `useState` for open/closed. It renders at most two lines: a toggle button and a paragraph. The collapsible behaviour wraps a single `<p>` of session title text. Collapsing it hides a line of dimmed text. This seems premature — the session info is arguably better as a non-collapsible label until there is more than one thing to show.

No action required unless the sidebar gets busier.

---

## 3. Strengths

- **`reformulator.py` is well-shaped.** It follows the same pattern as `clarifier.py` and `router.py`. The separation of system prompt into a separate file is consistent and appropriate. The `_ReformulatorPayload` internal model is a clean way to enforce structured output.

- **`api/client.ts` is exemplary.** The single `request<T>()` helper with typed `ApiRequestInit` is direct and non-redundant. Every exported function is a one-liner delegation. No factories, no base classes, no interceptor chains.

- **`handleRestoreSession` is readable.** The stage-advancement logic (lines 610–618) is a plain if/else-if chain rather than a lookup table or dispatcher — correct choice for four cases.

- **`autosaveSession` is deliberately fire-and-forget.** The empty `catch` block with a comment (line 355–357) is the right call: autosave failures should never block the user. Good restraint.

- **`Workbench.tsx` is not a god component.** At 863 lines it is large, but the breakdown is correct: it owns workflow state and delegates rendering entirely to stage components. The stage components (`IntentStage`, `CompileStage`, etc.) are genuinely isolated. The file size is a function of having 6 stages with their handlers, not of doing too many things.

- **`CompileStage.tsx` version history toggle** is a local `useState` for `showVersions` — correctly local, not lifted to the orchestrator.

- **`IntentStage.tsx` reformulate step machine** is clean. Three string states (`write` / `loading` / `review`) with a bail-to-write on error. No enums, no reducers, no external state.

- **E2E tests test behaviour, not implementation.** The Playwright tests assert visible text and button states, not internal React state or component props. That is the right level.

---

## 4. Verdict

**PASS WITH NOTES**

The code is directionally simple. The new features (reformulator, autosave, draft restore) are implemented without unnecessary abstraction and the frontend components are appropriately decomposed. The three issues worth fixing before the next phase are F1/F2 (flatten the store classes — they are OOP without a reason), F3 (cut the `update_session` merge boilerplate in half), and F6 (type the `autosaveSession` overrides parameter to catch typos). The remaining findings are low-severity style notes.
