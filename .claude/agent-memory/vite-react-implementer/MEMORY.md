# Vite React Implementer - Project Memory

## Project: Prompt OS

See `architecture.md` for detailed notes.

## Key Patterns

### Playwright E2E (added 2026-03-08)

- API base: `http://127.0.0.1:8000` (not localhost). Route intercepts must use this exact origin.
- Dev server: `http://127.0.0.1:5173` (playwright.config.ts baseURL)
- Tests live in `frontend/e2e/`, config at `frontend/playwright.config.ts`
- Run: `cd frontend && bun run e2e` (or `bun run e2e:ui` for interactive)
- Root shortcut: `bun run e2e` (delegates to frontend)
- Register more-specific routes BEFORE wildcard routes in `page.route()` — order matters
- Use `exact: true` on `getByRole('button', { name: 'Library' })` to avoid matching "Save to library"

### WorkflowStage accordion

- `isExpanded = status === 'active'` — only active stage shows its children
- `canToggle = status === 'complete' && onToggle` — completed stages are clickable
- `status === 'idle'` → content hidden, opacity 0.55

### Session restore logic (handleRestoreSession)

- Advances to "compile" if `compiled_versions.length > 0`
- Advances to "model" if `selected_model` is set
- Advances to "clarify" if `clarify_rounds.length > 0`
- Advances to "intent" if `rough_intent` is set (and nothing above matches)
- Stays at "context" otherwise
