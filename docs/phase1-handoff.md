# Phase 1 Handoff

**Completed:** 2026-03-08
**Commits:** f764b99 (initial), b94c20b (domain model + API), 7728a0c (migration, tests, types)

---

## What was done

### Git

- Repository initialized with `main` branch
- `.gitignore` excludes `.venv`, `node_modules`, `data/sessions`, `data/library`, `data/maps`, `.env`

### Domain model rewrite (backend/models.py)

**ModelChoice** — expanded from 3 to 10:
`gpt-5.4 | gpt-5-mini | gpt-4.1 | claude-opus-4-6 | claude-sonnet-4-6 | claude-haiku-4-5 | gemini-3.0-flash | gemini-3.0-pro | kimi-k2.5 | minimax-m2.5`

**TaskType** — `frontend_iteration` renamed to `frontend`, `implement` added:
`refactor | frontend | audit | implement`

**SessionStatus** — `draft` added: `draft | open | closed`

**New types:**

- `ClarifyRound` — a single round of clarifying Q&A (id, round_number, questions, answers, created_at)
- `CompiledVersion` — a single compiled prompt output (id, version_label, compiled_prompt, target_model, project_context_used, created_at)

**Session changes:**

- Replaced flat `clarifying_questions` + `clarifying_answers` with `clarify_rounds: list[ClarifyRound]`
- Replaced single `compile_result` with `compiled_versions: list[CompiledVersion]`
- Added `reformulated_intent: str | None` (for Phase 3 intent reformulation step)
- Added `selected_model: ModelChoice | None` (user's explicit model choice)
- Dropped `notes: list[SessionNote]` entirely

**Prompt (library) changes:**

- `why_it_works` → `expected_result_assessment: str | None` (optional)
- `effectiveness_rating` range expanded: 1–7 (was 1–5)
- Added `compiled_version_id: str | None`

**SessionUpdateRequest** — new append semantics:

- `append_clarify_round: ClarifyRound | None` — appends one round to session history
- `append_compiled_version: CompiledVersion | None` — appends one compiled version
- Added `reformulated_intent`, `selected_model` update fields
- Removed `note_body` (notes dropped)

### API updates (backend/main.py)

- Session create/update endpoints updated for new model shapes
- Added `GET /api/sessions/{session_id}` endpoint
- `latest_open()` now includes `draft` status
- API version bumped to 0.2.0

### Data migration (backend/migrate.py)

- Migrates `data/sessions/*.json` and `data/library/*.json` in-place
- Idempotent — safe to run multiple times
- Run: `backend/.venv/bin/python backend/migrate.py`
- All 3 existing files (2 sessions, 1 library item) migrated and validated

### Tests (backend/tests/)

- **61 pytest tests**, all passing
- `test_models.py` — 13 test classes covering every domain type
- `test_migration.py` — 4 test classes covering transforms + roundtrips
- Run: `backend/.venv/bin/pytest backend/tests/ -v`
- `conftest.py` at project root sets sys.path automatically (no PYTHONPATH needed)

### Frontend types (frontend/src/types/index.ts)

- Mirrors new `backend/models.py` field-for-field
- New interfaces: `ClarifyRound`, `CompiledVersion`
- `Session`, `SessionCreateRequest`, `SessionUpdateRequest` rewritten
- `Prompt`, `PromptCreateRequest` updated
- `SessionNote` removed
- `TASK_OPTIONS` — 4 entries with plain product-facing summaries
- `MODEL_OPTIONS` — 10 entries
- `getDefaultModelForTask` — frontend→Sonnet, implement→GPT-5 Mini, default→GPT-5.4

---

## What Phase 2 starts with

The frontend currently uses the old `Workbench.tsx` (~907 lines) which references the old types. Phase 2 begins with the UI restructure — components that reference removed fields (`clarifying_questions`, `compile_result`, `notes`, `why_it_works`) will need updating as part of the progressive disclosure rewrite.

**Known frontend files that will need updating:**

- `frontend/src/pages/Workbench.tsx` — all workflow state
- `frontend/src/components/SessionSidebar.tsx` — references session notes
- `frontend/src/components/ClarifyingQuestions.tsx` — uses old flat Q&A
- `frontend/src/components/CompiledOutput.tsx` — references single compile_result
- `frontend/src/api/client.ts` — API call shapes need updating

**Phase 2 goal:** Progressive disclosure UI, proper navigation shell, stage gating, task type redesign, dark mode tokenized color palette.

**Backend improvements to include in Phase 2** (from Phase 1 audit):

- Share a single OpenAI client instance across clarifier/compiler/router (currently recreated per call, losing HTTP connection reuse)
- Run harvester in a thread pool (`asyncio.to_thread`) to avoid blocking the FastAPI event loop during repo map generation
- Tighten CORS `allow_origin_regex` to match only expected dev ports instead of any localhost port
- Sanitize OpenAI error messages before returning in HTTP responses (currently forwards verbatim, risking API key leak in auth errors)

---

## Run commands

```bash
# Run backend tests
backend/.venv/bin/pytest backend/tests/ -v

# Run migration (if needed on fresh data)
backend/.venv/bin/python backend/migrate.py

# Start backend
backend/.venv/bin/uvicorn backend.main:app --reload

# Start frontend
cd frontend && bun dev
```
