# Phase 2 Handoff

**Completed:** 2026-03-08
**Branch:** `phase2/ui-restructure` (9 commits ahead of `main`)
**Commits:** f230896 → ed1754a

---

## What was done

### Backend audit fixes

- **Shared OpenAI client** (`backend/openai_client.py`): thread-safe lazy singleton via `get_client()` with double-checked locking. All AI modules (clarifier, compiler, router) import from it instead of creating their own clients.
- **Async harvester**: `harvest_project()` wrapped with `asyncio.to_thread()` in the map generation endpoint to avoid blocking the FastAPI event loop.
- **Tightened CORS**: Removed `allow_origin_regex` that matched any localhost port. Only explicit origins (ports 3000, 3005, 5173) are allowed.
- **Sanitized error messages**: `_to_ai_http_exception` now returns generic message for auth/API-key errors and redacts `sk-*` tokens from other errors.
- **Tests added**: 6 new backend tests (67 total) covering `get_client()` behavior and `_to_ai_http_exception` sanitization.

### Design system + dark mode

- **CSS tokens**: All colors in `styles.css` converted to semantic CSS custom properties on `:root` (bg, text, border, accent, status, stage, shadow, gradient tokens).
- **Dark palette**: Professional dark blue-gray theme via `[data-theme="dark"]` selector.
- **ThemeSwitcher component**: Toggle button with Sun/Moon icons (lucide-react), persists to localStorage, respects `prefers-color-scheme`.
- **All new components** use `var(--token-name)` for colors — no hardcoded hex/rgba.

### Navigation shell (App.tsx rewrite)

- **Global header**: App name "Prompt OS" + tagline + ThemeSwitcher on right.
- **Left sidebar**: Icon + label nav rows (Wrench/BookOpen/FolderGit2 from lucide-react) with active state highlighting.
- **Collapsible session section**: Placeholder in sidebar, ready for Phase 3 wiring.
- **Removed**: Old card-styled nav items, "Current surface" panel, `.app-sidebar` CSS class.

### API client alignment

- Added `getSession(sessionId)` function for `GET /api/sessions/{session_id}`.
- All types verified to match Phase 1 domain model.

### Workflow engine + progressive disclosure (Workbench rewrite)

- **Monolith decomposed**: `Workbench.tsx` went from ~907 lines to ~637 lines (orchestrator) + 7 stage components.
- **6-stage workflow**: context → intent → clarify → model → compile → save.
- **Progressive disclosure**: Only current stage expanded; completed stages collapse to summary rows; future stages show locked placeholders.
- **Stage gating**: Cannot skip ahead; each stage has a completion action that advances to the next.
- **Backwards navigation**: Going back resets downstream state to prevent stale data.
- **ARIA accessibility**: WorkflowStage has `aria-expanded`, `aria-controls`, `role="region"`.

### Stage components (`frontend/src/components/workflow/`)

| Component           | Purpose                                                                              |
| ------------------- | ------------------------------------------------------------------------------------ |
| `WorkflowStage.tsx` | Generic expand/collapse wrapper with status indicators                               |
| `ContextStage.tsx`  | Project dropdown + task type FAQ-style accordion                                     |
| `IntentStage.tsx`   | Textarea with task-type-conditional hints, skip option                               |
| `ClarifyStage.tsx`  | Multi-round Q&A (ClarifyRound[]), expandable summaries, skip/another-round options   |
| `ModelStage.tsx`    | Compact recommendation, collapsible reasoning, override dropdown                     |
| `CompileStage.tsx`  | Payoff surface, copy button, version history (CompiledVersion[]), iteration controls |
| `SaveStage.tsx`     | Title, 1-7 rating, optional expected result assessment                               |

### Copy rewrite

All jargon-heavy copy replaced with plain/technical-with-explanation tone. Task-type-conditional hints throughout.

### Old components deleted

- `ClarifyingQuestions.tsx`, `CompiledOutput.tsx`, `IntentInput.tsx`, `ModelSelector.tsx`, `ProjectSelector.tsx`, `SessionSidebar.tsx` — all replaced by workflow stage components.

### Frontend unit tests

- **Infrastructure**: Vitest + @testing-library/react + jsdom
- **36 tests** across 5 test files: WorkflowStage (10), ContextStage (7), IntentStage (9), SaveStage (7), ThemeSwitcher (3)
- **All passing**

### Library.tsx fix

Updated `why_it_works` references to `expected_result_assessment` to match the Phase 1 domain model.

---

## What Phase 3 starts with

The progressive disclosure workflow is functional but several end-to-end flows are not yet wired:

### Not yet implemented (Phase 3 scope)

1. **Autosave at stage transitions** — The `autosaveSession()` function exists in Workbench.tsx and is called at key points, but full autosave logic (creating sessions automatically, restoring from drafts) needs completion.

2. **Draft restore** — When reopening a session/draft, the visible state should repopulate all stages. The `goToStage` mechanism exists but session-to-workflow-state mapping needs wiring.

3. **Version history with decimal versioning** — CompiledVersion[] is stored and displayed, but version labels currently use integer bumps (1.0, 2.0). The plan specifies decimal bumps within a prompt (3.01, 3.02) for iterations of the same prompt.

4. **Intent reformulation step** — The `reformulated_intent` field exists on Session and in the types, but no UI or API call exists to have GPT 5.4 rewrite the user's raw intent before clarification.

5. **Library save flow refinement** — SaveStage works but could be tighter: auto-derive title, clearer feedback, link back to session.

6. **Playwright E2E tests** — No E2E tests exist yet.

7. **Dark mode for Tailwind utility classes in remaining pages** — Library.tsx and Projects.tsx still use static `@theme` palette classes (`text-ink-900`, `bg-white`, etc.) that don't adapt in dark mode. These pages need updating to use CSS token variables.

### Known issues

- Library.tsx and Projects.tsx still use old component patterns (not workflow stages, which is correct — they aren't workflows). But their color references need tokenizing for dark mode.
- The sidebar session section is a static placeholder — needs wiring to actual session state.
- Version numbering uses integer labels (1.0, 2.0) instead of the planned decimal bumps.

---

## Run commands

```bash
# Run backend tests (67 tests)
backend/.venv/bin/pytest backend/tests/ -v

# Run frontend tests (36 tests)
cd frontend && bun run test

# Run migration (if needed on fresh data)
backend/.venv/bin/python backend/migrate.py

# Start backend
backend/.venv/bin/uvicorn backend.main:app --reload

# Start frontend
cd frontend && bun dev

# Build frontend
cd frontend && bun run build
```

---

## Commit history (phase2/ui-restructure)

```
ed1754a feat: add frontend test infrastructure with vitest and 36 unit tests
7eca287 fix: address workflow engine code review issues
210a725 feat: rewrite Workbench as progressive disclosure workflow engine
dbd5b45 fix: remove dead .app-sidebar CSS, make session section collapsible
6d35abd feat: rewrite App.tsx with proper navigation shell
094725c feat: tokenize CSS colors + add dark mode support
39027f9 feat: add getSession endpoint to API client
846ba38 fix: thread-safe OpenAI client singleton + tests for audit fixes
f230896 fix: backend audit — shared OpenAI client, async harvester, tighter CORS, sanitized errors
```
