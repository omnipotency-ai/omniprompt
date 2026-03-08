# Performance Audit — Phase 3 / E2E Flows

**Date:** 2026-03-08
**Branch:** `phase3/e2e-flows`
**Auditor:** Claude Code (claude-sonnet-4-6)
**Scope:** All files changed in the PR diff

---

## 1. Summary

The Phase 3 PR is overall well-structured, but it contains one blocking backend performance defect: the new `reformulate()` function is a synchronous blocking call executed directly inside an `async def` FastAPI endpoint with no `asyncio.to_thread` offload, which will stall the entire event loop on every reformulation request. The frontend autosave logic also lacks debouncing and fires redundantly on closely-spaced user interactions, creating unnecessary write pressure. Neither issue is catastrophic at single-user scale, but both should be fixed before the app sees concurrent use.

---

## 2. Findings

---

### F-01: Blocking sync call inside async FastAPI endpoint — reformulate()

**Severity:** High

**File:** `backend/main.py`, lines 244–253; `backend/reformulator.py`, lines 21–46

**Description:**
The `/api/reformulate` endpoint is declared `async def` but calls `reformulate()` synchronously:

```python
@app.post("/api/reformulate", response_model=ReformulateResponse)
async def reformulate_intent(payload: ReformulateRequest) -> ReformulateResponse:
    repo_map = _load_repo_map(project_registry, payload.project_id)
    try:
        return reformulate(...)          # <-- BLOCKING sync call
```

`reformulate()` in `backend/reformulator.py` calls `client.responses.parse(...)` on the OpenAI SDK, which is a **synchronous** HTTP request. The `openai` SDK's `OpenAI` client (not `AsyncOpenAI`) is used throughout this project (confirmed in `backend/openai_client.py`). When this runs inside an `async def` endpoint without `await asyncio.to_thread(...)`, it blocks FastAPI's event loop thread for the entire duration of the OpenAI round-trip — typically 1–5 seconds at `reasoning={"effort": "low"}`.

This is the same anti-pattern that was already correctly handled in `/api/projects/{project_id}/map` (line 338: `await asyncio.to_thread(harvest_project, ...)`), and in the existing `/api/clarify`, `/api/compile`, and `/api/route` endpoints — all of which have the same problem, pre-existing before this PR, but this PR adds a new instance.

**Recommendation:**
Either wrap the call in `asyncio.to_thread`:

```python
return await asyncio.to_thread(
    reformulate,
    task_type=payload.task_type,
    rough_intent=payload.rough_intent,
    repo_map_summary=repo_map.summary if repo_map else None,
)
```

Or, for a deeper fix, switch the OpenAI calls to use `AsyncOpenAI` and make `reformulate()` itself an `async def`. Note: the pre-existing `/api/clarify`, `/api/compile`, and `/api/route` endpoints have the same problem, but that is out of scope for this PR.

---

### F-02: Redundant autosave on reformulate + intent continue

**Severity:** Medium

**File:** `frontend/src/pages/Workbench.tsx`, lines 385–401

**Description:**
When the user clicks "Reformulate and continue" and then accepts the reformulated text, the following sequence fires:

1. `handleReformulateIntent()` is called — it calls `void autosaveSession({ reformulated_intent: ... })` (line 391).
2. `handleAcceptReformulated()` in `IntentStage` calls `onContinue()` which is wired to `handleIntentContinue()`.
3. `handleIntentContinue()` calls `void autosaveSession()` again (line 397) — no overrides, this is a plain session update with the current field snapshot.

This means **two** sequential `PUT /api/sessions/:id` requests are fired within milliseconds of each other, with the second one racing the first. The second write carries no new information that the first didn't already contain (since the reformulated intent was committed to the parent's state before `onContinue` is called via `onIntentChange`). At best it is a wasted write; at worst, if session update is ever extended to append-only semantics, the race could corrupt data.

There is a similar double-save in the clarify → model transition: `handleClarifySubmitAndContinue()` calls `archiveCurrentRound()` which triggers `void autosaveSession({ append_clarify_round: round })`, then `handleRouteRequest()` calls `void autosaveSession(...)` again on success (line 467).

**Recommendation:**
In `handleIntentContinue`, skip the redundant `autosaveSession()` call when reformulation already saved. The simplest fix is to pass a flag or to have `handleReformulateIntent` return a boolean indicating it already saved, so `handleIntentContinue` can skip its own save. Alternatively, track a "dirty" flag per session update and deduplicate in `autosaveSession` itself using a short debounce (300–500 ms).

---

### F-03: No debouncing on autosave — fires on every stage transition

**Severity:** Medium

**File:** `frontend/src/pages/Workbench.tsx`, lines 335–358

**Description:**
`autosaveSession()` is a fire-and-forget async function with no debounce, rate limit, or deduplication. It is called on every stage transition:

- `handleContextContinue` — fires (line 382)
- `handleIntentContinue` — fires (line 397)
- `handleIntentSkipToModel` — fires (line 404)
- `handleClarifySkip` — fires (line 438)
- `handleRouteRequest` on success — fires (line 467)
- `handleModelAccept` — fires (line 482)
- `handleCompileContinue` — fires (line 534)
- Plus the domain-specific autosaves with append payloads (clarify rounds, compiled versions, reformulated intent)

A user who clicks quickly through stages — or who triggers "Skip reformulation" immediately after the reformulate call resolves — can queue 3–5 concurrent PUT requests. Since the function swallows all errors (`catch { // Autosave failures are non-blocking }`), there is no indication of failure and no retry logic. If the last write loses a race to an earlier one (which can happen if the backend processes them out of order), the session's `updated_at` will be stale.

**Recommendation:**
Introduce a simple debounce mechanism. A 300 ms leading-edge debounce on the non-append autosave calls is sufficient. The append-type saves (clarify round, compiled version) must not be debounced because they carry new data, but the plain-snapshot saves (context continue, intent continue, model accept, compile continue) can be safely coalesced.

---

### F-04: Two parallel fetch calls on every mount — projects and sessions/latest not batched

**Severity:** Low

**File:** `frontend/src/pages/Workbench.tsx`, lines 195–244

**Description:**
On mount (and whenever `refreshKey` changes), `WorkbenchPage` fires two independent `useEffect` hooks simultaneously:

- `useEffect(() => { ... listProjects() ... }, [refreshKey])` (line 195)
- `useEffect(() => { ... getLatestSession() ... }, [refreshKey])` (line 226)

These are independent, parallel fetches — which is not a bug — but it means two HTTP round-trips on every page load. Both effects depend on the same `refreshKey`, which means both will re-run when any project mutation happens (e.g., adding a project), even though `getLatestSession()` has no relationship to projects. This causes an unnecessary re-fetch of the latest session every time a project is added or removed.

**Recommendation:**
Give the session-check `useEffect` an empty dependency array `[]` so it runs only once on mount. `refreshKey` should only trigger a project re-fetch, not a session re-check. The session restore banner should only appear once per page load; re-checking it on project mutations is meaningless and potentially confusing (the banner could reappear after a project add).

```tsx
useEffect(() => {
  // ...
  void checkForSession();
  return () => {
    cancelled = true;
  };
}, []); // <-- not [refreshKey]
```

---

### F-05: Uncleared setTimeout in CompileStage — minor memory/timer leak

**Severity:** Low

**File:** `frontend/src/components/workflow/CompileStage.tsx`, lines 36–40

**Description:**
The copy-confirmation timer is created with `setTimeout` but never cleared if the component unmounts before it fires:

```tsx
function handleCopy() {
  onCopy();
  setCopied(true);
  setTimeout(() => setCopied(false), 2000); // <-- never stored, never cleared
}
```

If `CompileStage` unmounts within 2 seconds of a copy action (e.g., user navigates backwards to the intent stage), the `setTimeout` callback will attempt to call `setCopied` on an unmounted component. React 18 suppresses this warning but the timer still executes and holds a closure reference to the component's state setter. Over many clicks this is negligible but it is a correctness issue in strict mode.

**Recommendation:**
Store the timer ID in a `useRef` and clear it in a `useEffect` cleanup, or use the cleanup-friendly pattern:

```tsx
const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

function handleCopy() {
  onCopy();
  setCopied(true);
  if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
}

useEffect(
  () => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  },
  [],
);
```

---

### F-06: Inline callback allocations on every Workbench render — missing useCallback

**Severity:** Low

**File:** `frontend/src/pages/Workbench.tsx`, lines 714–817

**Description:**
Every render of `WorkbenchPage` creates fresh function references for all event handler props passed to child stage components. Examples:

- Line 727: `onTaskTypeChange={(tt) => { setTaskType(tt); setSelectedModel(...) }}` — new arrow function on every render
- Line 767: `onAnswerChange={(qId, val) => setAnswersByQuestionId((prev) => ({ ...prev, [qId]: val }))}` — new closure on every render
- Line 811: `onRegenerate={() => void handleCompileRequest()}` — new closure on every render
- Line 812: `onIterateFrom={(label) => void handleCompileRequest(label)}` — new closure on every render

All stage child components (`ContextStage`, `ClarifyStage`, `CompileStage`, etc.) are plain functional components without `React.memo`, so the extra allocation is currently harmless — they re-render anyway when parent state changes. However, this creates unnecessary object churn on every render cycle.

At the current app scale this is negligible. It becomes meaningful if:
(a) child components are wrapped in `React.memo` in a future performance pass, or
(b) the callback identity matters for downstream `useEffect` dependency arrays.

**Recommendation:**
Low priority. Add `useCallback` wrappers for the inline lambdas that are passed as props when/if child components are memoized. No action needed immediately.

---

### F-07: `_load_repo_map` re-reads projects.json on every AI endpoint call

**Severity:** Low / Info

**File:** `backend/main.py`, lines 545–581; `ProjectRegistry.get()` lines 110–114

**Description:**
`_load_repo_map` calls `project_registry.get(project_id)`, which calls `self.list()`, which reads and deserializes the entire `projects.json` file from disk on every call. Every call to `/api/reformulate`, `/api/clarify`, `/api/compile`, and `/api/route` therefore does a full file read + JSON parse + Pydantic validation of all projects before dispatching to the AI. This is a pre-existing issue not introduced by this PR, but the new `/api/reformulate` endpoint adds another call site.

For a small projects file (2–3 entries as seen in `data/projects.json`) this is sub-millisecond. It becomes noticeable only if the projects list grows large or the file is on a slow filesystem.

**Recommendation:**
No immediate action required at current scale. Document this as a known inefficiency to revisit when migrating to SQLite (Phase 4), where a single indexed lookup replaces the full file scan.

---

### F-08: `SessionStore.latest_open()` performs a full scan

**Severity:** Info

**File:** `backend/main.py`, lines 190–193

**Description:**
`latest_open()` calls `self.list()` which reads and sorts all session files from disk, then iterates them to find the first open one. At N sessions, this is O(N) disk reads. This is pre-existing, not introduced by this PR. The new `GET /api/sessions/latest` endpoint (also pre-existing) exposes this path, and it is now called on every workbench mount.

At current scale (few sessions) this is fast. It is documented here so the Phase 4 SQLite migration can replace it with a `SELECT ... WHERE status IN ('draft', 'open') ORDER BY updated_at DESC LIMIT 1` query.

**Recommendation:**
No action needed in Phase 3. Flag for Phase 4.

---

### F-09: Playwright dependency added to devDependencies — bundle-safe

**Severity:** Info

**File:** `frontend/package.json`; `frontend/bun.lock`

**Description:**
`@playwright/test` (~playwright-core binary) is added as a `devDependency`. This is correctly scoped and will not contribute to the production bundle. The binary is large (~200 MB on first install) but is a development-only artifact. No performance concern for users.

---

## 3. Strengths

**Shared OpenAI client with connection reuse.** `backend/openai_client.py` uses a module-level singleton with double-checked locking. All AI calls — including the new reformulator — share a single HTTP connection pool, avoiding per-request client instantiation overhead.

**Autosave is fire-and-forget and non-blocking.** The `void autosaveSession()` pattern correctly prevents autosave from blocking user-facing actions. Failures are silently swallowed, which is the right tradeoff for a persistence side-effect.

**Cancellation tokens in useEffects.** Both `useEffect` hooks in `Workbench.tsx` implement `cancelled` guards (lines 196–223, 226–244), correctly preventing stale state updates after unmount or dependency change. This is the idiomatic pattern and done correctly here.

**`useMemo` used appropriately.** `selectedProject` and `allAnswers` are correctly memoized (lines 181–192), avoiding re-computation on unrelated state changes.

**Atomic file writes via temp file + rename.** Both `_write_json_file` and `ProjectRegistry._write` use a write-to-temp-then-rename pattern (lines 143–145, 516–518), which is safe under concurrent writes and avoids partial-write corruption.

**`reasoning: {"effort": "low"}` and `max_output_tokens: 800` on reformulator.** The new reformulator endpoint is correctly constrained to minimize latency and cost. These limits are appropriate for the task.

**E2E tests use route mocking, not real API calls.** All Playwright tests mock every API endpoint, meaning they are hermetic, fast, and cannot accidentally mutate production data or incur OpenAI costs.

---

## 4. Verdict

**PASS WITH NOTES**

The PR is mergeable for a single-user dev tool at current scale, but the blocking sync call in F-01 is a genuine correctness defect under async semantics and should be fixed before the app handles more than one concurrent user. F-02 and F-03 (redundant autosave, no debounce) create unnecessary write noise and a latent race condition that should be addressed in Phase 4. F-04 (session check re-runs on project mutations) is a simple one-line fix that should accompany this PR before merge.

Priority fixes before merge:

1. **F-01** — wrap `reformulate()` in `asyncio.to_thread` in the endpoint handler
2. **F-04** — change the session-check `useEffect` dependency from `[refreshKey]` to `[]`

Deferred to Phase 4:

- F-02, F-03 (autosave debounce and deduplication)
- F-05 (CompileStage timer cleanup)
