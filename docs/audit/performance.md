# Performance Audit

**Date:** 2026-03-08
**Scope:** Full codebase (backend + frontend)

## Findings

### [HIGH] Harvester walks entire repo tree synchronously with no file count limit

**File:** `/Users/peterjamesblizzard/projects/_prompt_os/backend/harvester.py:41-59`
**Description:** `harvest_project()` calls `_collect_files()` and `_build_tree_lines()`, both of which recursively walk the entire project directory. There is no cap on total file count or total bytes processed. For every code file under 512 KB, the harvester reads the full file contents to extract exports (`_extract_exports` at line 143), and for Python files it parses the full AST (`ast.parse` at line 158). The tree walk itself happens twice independently (`_walk_paths` and `_append_tree_lines` both recurse the same directory tree).
**Impact:** A project with 10,000+ files (common for monorepos or projects with vendored dependencies) would trigger tens of thousands of `stat()` and `iterdir()` calls, plus thousands of full file reads and AST parses. On a repo with 15k files, this could take 30-60 seconds and consume hundreds of megabytes of memory. The endpoint (`POST /api/projects/{id}/map`) is a synchronous `async def` that blocks the event loop for the entire duration -- the FastAPI server is completely unresponsive during harvesting.
**Recommendation:**

1. Add a configurable `MAX_FILE_COUNT` cap (e.g., 10,000) with an early exit.
2. Merge the two tree walks into a single pass instead of walking the directory twice.
3. Run the harvester in a thread pool via `asyncio.run_in_executor()` so it does not block the event loop.
4. Consider streaming or chunked export extraction rather than reading all files into memory.

### [HIGH] Harvester blocks the async event loop

**File:** `/Users/peterjamesblizzard/projects/_prompt_os/backend/main.py:312-335`
**Description:** The `generate_project_map` endpoint is declared `async def` but calls `harvest_project()` directly, which performs heavy synchronous filesystem I/O and CPU work (AST parsing, regex matching). In FastAPI, `async def` endpoints run on the main event loop thread. All other requests (including lightweight ones like `GET /api/sessions`) are blocked until harvesting finishes.
**Impact:** The UI becomes completely unresponsive during repo map generation. If the user clicks any button while a map is generating, those requests queue behind the blocking call. For large repos this could mean 30+ seconds of total UI freeze.
**Recommendation:** Either change the endpoint to a plain `def` (FastAPI will auto-run it in a threadpool), or explicitly use `await asyncio.to_thread(harvest_project, ...)`.

### [HIGH] OpenAI client is recreated on every API call

**File:** `/Users/peterjamesblizzard/projects/_prompt_os/backend/compiler.py:100-104`, `/Users/peterjamesblizzard/projects/_prompt_os/backend/clarifier.py:58-62`, `/Users/peterjamesblizzard/projects/_prompt_os/backend/router.py:79-83`
**Description:** Each of the three AI modules (`compiler.py`, `clarifier.py`, `router.py`) has its own `_build_client()` function that creates a new `OpenAI()` instance on every call. The OpenAI client internally creates an `httpx.Client` with a connection pool. Recreating it on every request means:

- No HTTP connection reuse between calls.
- New TLS handshake for every API request.
- The old client's connection pool is never explicitly closed (relies on GC).
  **Impact:** Each AI call pays an extra ~100-200ms for TLS negotiation that could be avoided with connection reuse. For a typical workflow (clarify + route + compile), that is 300-600ms of unnecessary latency. The user feels this as sluggishness between steps.
  **Recommendation:** Create one shared `OpenAI` client at module level or app startup. Lazy-initialize it on first use if you want to defer the API key check.

### [HIGH] No timeout on OpenAI API calls

**File:** `/Users/peterjamesblizzard/projects/_prompt_os/backend/compiler.py:114-120`, `/Users/peterjamesblizzard/projects/_prompt_os/backend/clarifier.py:35-43`, `/Users/peterjamesblizzard/projects/_prompt_os/backend/router.py:53-61`
**Description:** None of the OpenAI API calls specify a `timeout` parameter. The OpenAI Python SDK defaults to 10 minutes for request timeout. If the API is slow or hangs, the user has no feedback and no recourse -- the FastAPI endpoint just hangs.
**Impact:** A single slow or stalled OpenAI API call can hang the UI for up to 10 minutes. There is no abort mechanism in the frontend either -- `fetch()` calls in `client.ts` have no `AbortController` or timeout.
**Recommendation:** Set explicit timeouts on the OpenAI client (e.g., 60s for compile, 30s for clarify/route). Add `AbortController` with timeout on the frontend `fetch()` calls so the user can navigate away or retry.

### [MEDIUM] `ensure_storage()` called on every read operation

**File:** `/Users/peterjamesblizzard/projects/_prompt_os/backend/main.py:74-81,142-144,166-169,475-481`
**Description:** `ProjectRegistry`, `PromptLibraryStore`, and `SessionStore` all accept an `on_read` callback that is set to `ensure_storage`. This means every `list()`, `get()`, `create()`, and `update()` call triggers 4 `mkdir()` calls and 1 `exists()` check. These are syscalls that hit the filesystem on every single API request.
**Impact:** Each request adds 5 unnecessary filesystem syscalls. On macOS with APFS, each call is ~0.1ms, so the total overhead is ~0.5ms per request -- not individually noticeable, but wasteful. The `_write()` method in `ProjectRegistry` also calls `ensure_storage`, meaning a `create` or `update` triggers it twice (once on `list()`, once on `_write()`).
**Recommendation:** Call `ensure_storage()` once at startup (which is already done in the `startup` event) and remove the `on_read` callback pattern. Use a simple boolean flag if you want a "called at least once" guarantee.

### [MEDIUM] ProjectRegistry.get() loads all projects to find one

**File:** `/Users/peterjamesblizzard/projects/_prompt_os/backend/main.py:103-107`
**Description:** `ProjectRegistry.get(project_id)` calls `self.list()` which reads the entire `projects.json` file and validates every project with Pydantic, then iterates to find the one with the matching ID. This is called by `_load_repo_map()` on every `/api/clarify`, `/api/compile`, and `/api/route` request.
**Impact:** For a single-user app with <20 projects, this is negligible (~1-2ms). However, the `create_project` endpoint calls `self.list()` twice (once to check for duplicates, once inside `create()`), and `update` calls `list()` then `_write()` which also calls `ensure_storage`. The real cost is the repeated JSON parse + Pydantic validation, not the linear scan.
**Recommendation:** For the current scale this is acceptable. If projects grow beyond ~50, consider an in-memory cache with file-change detection.

### [MEDIUM] SessionStore.latest_open() loads and sorts ALL sessions

**File:** `/Users/peterjamesblizzard/projects/_prompt_os/backend/main.py:183-187`
**Description:** `latest_open()` calls `self.list()` which globs all session JSON files, reads each one from disk, validates with Pydantic, and sorts by `updated_at`. It then iterates to find the first with status "draft" or "open". This endpoint (`GET /api/sessions/latest`) is called on every page load alongside `listSessions()`, so the same work happens twice in parallel.
**Impact:** With 50+ sessions, each containing multiple clarify rounds and compiled versions, this could mean reading and parsing several MB of JSON on every page load -- twice. Each session file could be 10-50 KB, so 50 sessions = 500 KB-2.5 MB of disk reads, parsed and validated twice.
**Recommendation:** The frontend already calls `listSessions()` in parallel with `getLatestSession()`. Consider having the frontend derive the latest open session from the sessions list instead of making a separate backend call. Alternatively, cache the session list in memory for the duration of a request.

### [MEDIUM] Workbench.tsx is a 907-line single component with 20+ useState hooks

**File:** `/Users/peterjamesblizzard/projects/_prompt_os/frontend/src/pages/Workbench.tsx:58-84`
**Description:** The `WorkbenchPage` component has approximately 20 `useState` calls. Any state change triggers a re-render of the entire 907-line component and all its children. Key issues:

- `answersByQuestionId` state changes on every keystroke/click in clarifying questions, causing the entire page to re-render.
- `workflowCards` (lines 140-177) is recomputed on every render since it is not memoized.
- Inline arrow functions are created on every render for `onChange` handlers (lines 655-661, 730-736, 778-787, 805-810, 818-823), preventing child component memoization.
- `resetDownstreamState` calls 7 state setters sequentially, causing multiple re-renders in React 18's batching (though React batches these in event handlers, they are still all processed).
  **Impact:** Each clarifying question answer triggers a full page re-render including the sidebar, all workflow cards, the model selector, and the compiled output. On a fast machine this is unlikely to cause visible jank, but it is wasteful. The `sessions.find()` in the `currentSession` useMemo runs on every render where sessions or currentSessionId change.
  **Recommendation:** Extract distinct workflow stages into separate components with their own state. Use `useCallback` for handlers passed to child components, and `React.memo` on child components like `SessionSidebar`, `ClarifyingQuestions`, `ModelSelector`, and `CompiledOutput`.

### [MEDIUM] Compiler retry doubles token cost without user consent

**File:** `/Users/peterjamesblizzard/projects/_prompt_os/backend/compiler.py:64-79`
**Description:** When the initial compile response hits the output token limit, the compiler automatically retries with a higher token budget (7000 -> 12000). This silently doubles the OpenAI API cost and latency for that request.
**Impact:** A single compile that hits the limit costs 2x tokens and takes 2x time (potentially 20-40 seconds total). The user sees "Compiling..." with no indication that a retry is happening or that they could narrow the task to avoid the retry.
**Recommendation:** Return the truncated result with a warning to the user, letting them decide whether to retry with a higher budget. Or at minimum, surface the retry in the UI so the user knows why it is taking longer.

### [MEDIUM] Frontend fetches sessions list redundantly

**File:** `/Users/peterjamesblizzard/projects/_prompt_os/frontend/src/pages/Workbench.tsx:251-263`
**Description:** `refreshSessionsState()` is called after every session mutation (create, update, sync, close, and after each AI step when a session is active). Each call fetches both `listSessions()` and `getLatestSession()`. Since `getLatestSession()` already loads all sessions on the backend (see finding above), this means the backend reads all session files from disk twice per mutation.
**Impact:** After each AI step (clarify, route, compile), if a session is active, the code calls `updateSession` then `refreshSessionsState`, which triggers 2 additional API calls. A full workflow (clarify -> route -> compile) with an active session triggers 6 extra session-list fetches beyond the initial page load.
**Recommendation:** Have `refreshSessionsState` call only `listSessions()` and derive the latest open session client-side. Better yet, have mutation endpoints return the updated session list or use optimistic updates.

### [LOW] `_should_skip` recomputes relative parts for every file

**File:** `/Users/peterjamesblizzard/projects/_prompt_os/backend/harvester.py:99-101`
**Description:** `_should_skip()` computes `path.relative_to(root_path).parts` for every file and directory encountered, then checks if any part is in `IGNORED_DIRS`. Since the walk is recursive and the parent directory's skip status was already checked, re-checking all ancestor parts is redundant.
**Impact:** Minor CPU overhead. For a repo with 10,000 entries, this means ~10,000 `relative_to` computations and tuple iterations. Negligible in absolute terms (<50ms) but easy to avoid.
**Recommendation:** Check only the current path's `name` against `IGNORED_DIRS` since the recursive walk already skipped ignored parent directories.

### [LOW] `backdrop-filter: blur()` on multiple stacked elements

**File:** `/Users/peterjamesblizzard/projects/_prompt_os/frontend/src/styles.css:63,106`
**Description:** Both `.app-sidebar` (`backdrop-filter: blur(18px)`) and `.panel` (`backdrop-filter: blur(14px)`) use backdrop blur. On a typical workbench page, there are 8+ `.panel` elements visible simultaneously, each with its own backdrop blur compositing layer.
**Impact:** Backdrop blur is GPU-composited. On integrated graphics (common on MacBook Air), 8+ simultaneous blur layers can cause frame drops during scroll or animation, particularly when panels overlap or are inside a scrollable container. On most modern hardware this is fine, but it is a known source of jank on lower-end machines.
**Recommendation:** Consider removing backdrop blur from `.panel` (keep it on `.app-sidebar` only) or reducing it to `blur(4px)`. Test on integrated-GPU hardware to confirm whether it causes actual frame drops.

### [LOW] OpenAI SDK imported at module level in three files

**File:** `/Users/peterjamesblizzard/projects/_prompt_os/backend/compiler.py:5`, `/Users/peterjamesblizzard/projects/_prompt_os/backend/clarifier.py:5`, `/Users/peterjamesblizzard/projects/_prompt_os/backend/router.py:5`
**Description:** All three AI modules import `from openai import OpenAI` at the top level. The OpenAI SDK is a moderately heavy import (~200ms) that loads `httpx`, `pydantic`, and other dependencies. Since all three modules are imported by `main.py` at startup, this adds to server start time.
**Impact:** Adds ~200-400ms to cold start. For a dev server that restarts on file changes, this is mildly annoying but not a real problem.
**Recommendation:** Not actionable for a local dev app. If startup time becomes a concern, lazy-import the OpenAI SDK inside the `_build_client()` functions.

### [LOW] Model knowledge files read from disk (cached after first read)

**File:** `/Users/peterjamesblizzard/projects/_prompt_os/backend/prompts/compiler_system.py:593-597`
**Description:** `_load_model_knowledge()` reads markdown files from `kernel/models/` directory. It uses `@lru_cache(maxsize=None)` so each file is only read once per process lifetime.
**Impact:** Negligible. First compile request pays ~1ms for a file read; subsequent requests are free. This is the correct pattern.
**Recommendation:** No action needed. This is already well-implemented.

## Summary

- 0 critical findings
- 4 high findings (harvester blocking + no file limit, event loop blocking, OpenAI client recreation, no API timeouts)
- 5 medium findings (ensure_storage overhead, N+1 project/session loading, Workbench re-renders, silent compile retry, redundant session fetches)
- 4 low findings (redundant skip checks, backdrop blur stacking, module import weight, model knowledge caching -- last one is a positive note)

The highest-impact items for a single user are:

1. **Harvester blocking the event loop** -- the UI freezes completely during repo map generation for large projects.
2. **No timeouts on OpenAI calls** -- a stalled API call hangs the UI indefinitely with no recourse.
3. **OpenAI client recreation** -- adds 300-600ms of unnecessary latency across a typical workflow.
