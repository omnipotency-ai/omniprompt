# Prompt OS - Full Project Context

> This document captures everything known from the 2026-03-08 session where the owner reviewed the app's state, overrode the engineered prompt constraints, and established the real project direction. Any future session should read this first.

---

## 1. What Prompt OS Is

A prompt-building workbench that takes a rough engineering intent, clarifies it through AI-driven questions, recommends a target model, and compiles a polished prompt artifact optimized for that specific model's strengths.

The core workflow is: **Context (project + task type) -> Intent (what you want) -> Clarify (AI asks follow-ups) -> Model (recommend/select target) -> Compile (produce final prompt) -> Save/Iterate (keep versions, reuse from library)**.

The owner's vision: this app should provide the same quality of iterative prompt refinement that having a direct conversation with Opus provides, but structured, persistent, and reusable. The app should be the tool that replaces going back to Opus manually.

## 2. Current State of the Codebase

### Tech stack

- **Backend:** Python 3.14, FastAPI, Pydantic v2, OpenAI API (GPT-5.4 for compilation/clarification, GPT-5 Mini for routing)
- **Frontend:** React 18+, TypeScript, Vite, Tailwind CSS
- **Persistence:** Flat JSON files in `data/` (no database)
- **Package manager:** bun (frontend), pip with venv (backend)
- **No git repository initialized yet**
- **No tests exist yet**
- **No CI/CD**

### File structure (source files only, excluding .venv and node_modules)

```
backend/
  main.py              - FastAPI app, route handlers, file-based stores (ProjectRegistry, PromptLibraryStore, SessionStore)
  models.py            - All Pydantic domain models and request/response schemas
  compiler.py          - OpenAI-powered prompt compilation (uses GPT-5.4)
  clarifier.py         - OpenAI-powered clarifying question generation (uses GPT-5.4)
  router.py            - OpenAI-powered model recommendation (uses GPT-5 Mini)
  harvester.py         - Repo map generator (walks filesystem, extracts exports)
  prompts/
    clarifier_system.py  - System prompt + task-specific guidance for clarifier
    compiler_system.py   - System prompt + task-specific guidance + model output blueprints for compiler
    router_system.py     - System prompt + model routing guidance for router
  .env                 - OPENAI_API_KEY (not committed)
  requirements.txt

frontend/
  src/
    main.tsx           - React entry point
    App.tsx            - Shell layout, left sidebar nav, page routing (useState-based, no router library)
    styles.css         - Tailwind + custom utility classes
    types/index.ts     - All TypeScript types, constants, helper functions (mirrors backend models.py)
    api/client.ts      - Typed fetch wrapper for all backend endpoints
    pages/
      Workbench.tsx    - Main workflow page (~907 lines, manages all workflow state)
      Library.tsx      - Saved prompts browser
      Projects.tsx     - Project registration and repo map management
    components/
      ProjectSelector.tsx     - Project dropdown + map status
      IntentInput.tsx         - Textarea with task-type-conditional hints
      ClarifyingQuestions.tsx  - Renders AI-generated questions (radio/checkbox/freetext)
      ModelSelector.tsx       - Model cards with recommendation badge
      CompiledOutput.tsx      - Final prompt display + copy button
      SessionSidebar.tsx      - Session management rail (start/resume/sync/notes/close)

data/
  projects.json        - Single project registered: _prompt_os itself
  sessions/            - 2 session JSON files (one open, one closed)
  library/             - 1 saved prompt (rated 1/5 - "not the point")
  maps/                - 1 repo map JSON

kernel/
  philosophy.md
  models/
    claude-sonnet-4-6.md  - Model knowledge file for compilation
    gpt-5.4.md            - Model knowledge file for compilation
    gpt-5-mini.md         - Model knowledge file for compilation
    _template.md          - Template for adding new models

docs/
  plan1.txt            - Product/UX plan, rewritten by user on 2026-03-08

package.json           - Root package.json with dev/build scripts
```

### Backend API endpoints

| Method | Path                     | Purpose                                    |
| ------ | ------------------------ | ------------------------------------------ |
| GET    | `/api/projects`          | List registered projects                   |
| POST   | `/api/projects`          | Register new project                       |
| POST   | `/api/projects/{id}/map` | Generate/refresh repo map                  |
| POST   | `/api/clarify`           | Generate clarifying questions from intent  |
| POST   | `/api/route`             | Get model recommendation                   |
| POST   | `/api/compile`           | Compile final prompt                       |
| GET    | `/api/library`           | List saved prompts                         |
| POST   | `/api/library`           | Save prompt to library                     |
| GET    | `/api/sessions`          | List all sessions                          |
| GET    | `/api/sessions/latest`   | Get latest open session                    |
| POST   | `/api/sessions`          | Create session                             |
| PUT    | `/api/sessions/{id}`     | Update session (partial, plus append note) |

### Current domain model (backend/models.py)

- **ModelChoice:** `"gpt-5.4" | "gpt-5-mini" | "claude-sonnet-4-6"`
- **TaskType:** `"refactor" | "audit" | "frontend_iteration"`
- **Session:** Has id, project_id, task_type, title, rough_intent, clarifying_questions, clarifying_answers, route_result (RouteResponse | null), compile_result (CompileResponse | null), status (open/closed), notes (list of SessionNote), timestamps
- **Prompt (library):** Has id, project_id, task_type, session_id, title, rough_intent, compiled_prompt, target_model, why_it_works, effectiveness_rating, created_at
- **CompileResponse:** task_type, target_model, compiled_prompt, project_context_used
- **RouteResponse:** task_type, recommended_model, estimated_complexity, reasoning, budget_alternative, advisory_only

### What's missing from the current domain model

- No concept of "draft" (distinct from session)
- No compiled prompt version history (single compile_result, overwritten)
- No clarification exchange history (single flat list, overwritten on re-clarify)
- No autosave behavior
- No revision lineage (can't trace v1 -> v2 -> v3 of a compiled prompt)
- No selected_model field on session (only route_result.recommended_model or compile_result.target_model)
- RouteResponse doesn't expose the input signals it used or candidate options list
- Library items are disconnected snapshots (no link back to session version)
- No intent reformulation step (GPT 5.4 articulating the task before clarification)

## 3. Owner's Decisions (All Confirmed)

These are direct answers from the owner, not assumptions:

1. **Autosave: YES.** Save automatically at workflow stage transitions (intent submitted, clarification completed, model confirmed, prompt compiled). Not on every keystroke.

2. **Draft vs Session vs Library distinction:**
   - **Draft** = the in-progress workbench state (not yet compiled or still being iterated)
   - **Session** = a completed or paused unit of work with full history (intent, clarification, compilation, revisions)
   - **Library** = a curated prompt worth reusing, extracted from a session

3. **Revision lineage: YES.** Keep all previous compiled prompt versions in the session history. Each prompt gets a unique number, with iterations of the same prompt using decimal version bumps (e.g., 3.01, 3.02, 3.03). The next prompt might be worse; you need to go back and iterate from a previous version.

4. **Git: YES.** Initialize git, set up .gitignore, make initial commit of current state before any changes.

5. **Testing: YES.**
   - Python: pytest for backend
   - Frontend: unit tests
   - E2E: Playwright

6. **Scope: Full domain model rewrite allowed.** The owner explicitly removed the "backward-compatible only" and "don't rewrite files" constraints. This is a v0.1 app with one iteration; clean rewrites are cheaper than additive layering.

7. **Override all artificial constraints from the engineered prompts.** The owner can be asked clarifying questions. Don't make assumptions - ask.

8. **Task types: CONFIRMED.** Core set for day one: `refactor | frontend | audit | implement`. Rename `frontend_iteration` to `frontend`. Migrate existing data. The `implement` type is for small, concrete, prescriptive tasks (e.g., "change this icon", "add this prop", "move this label") - batches of discrete changes with no ambiguity. Its clarification flow should be lighter than the other types.

9. **Multiple projects: YES.** The owner works across multiple projects (Omniflow, Stack It, Caca Tracker, Startup OS, and others) with different tech stacks (TanStack + Convex + Clerk, Vite React + Clerk + Convex, TanStack Router, React Router, tRPC, etc.). Multi-project support is essential because each project has a different repo map and tech stack that should inform prompt compilation.

10. **Model list expansion: YES.** The current three models must be extended. Confirmed additions: Opus 4.6, Haiku (4.5 or 4.6 - to be confirmed), Gemini 3.0 Flash, Gemini 3.0 Pro. Additional models to add: GPT-4.1, Kimi K2.5, Minimax M2.5. More may follow later.

11. **Session notes: DROP.** The version control history, clarifying Q&A, and prompt-level commentary are the meaningful history. Separate session-level notes are overkill. Prompt-level commentary replaces them (see Q8 below).

12. **Library save: SIMPLIFY.** There should be a simple save button. Additionally, an optional "expected result assessment" replaces the old "why it works" field. This lets the user say what went wrong or whether it captured their intent (e.g., "it asked Sonnet to create the prompts instead of giving me prompts for Sonnet").

13. **Effectiveness rating: EXPAND to 1-7.** Higher range for more granularity.

14. **Compiler architecture: CONFIRMED.** GPT-5.4 compiles prompts for all targets including Claude. The model knowledge docs (`kernel/models/*.md`) need to carry significant weight in the prompt compilation process so that model-specific fields, structure, and best practices are deeply embedded in the compiled output.

## 4. Owner's Frustrations and Design Intent

The owner tried to use Prompt OS to generate the refactor prompts for Prompt OS itself. It didn't work well:

- The compiled prompt targeted Claude Sonnet 4.6 but told Sonnet to _create_ three prompts instead of being a prompt _for_ Sonnet to execute. The owner wanted GPT-5.4 to create the prompts, with each prompt being executable by Sonnet. The tool confused the audience.
- The library entry rating of 1/5 with note "instead of giving me the three prompts to give to Sonnet 4.6 it's asking Sonnet 4.6 to create the three prompts. That's not the point."
- The owner ended up going back to Opus manually for the same quality of iterative conversation, which is exactly what the app should provide.
- The session concept doesn't restore meaningful state - "if I wanted a notebook, I would use notes, not an app"
- Copy is jargon-heavy ("blast radius", "add signal", "readable")
- Everything is shown at once instead of progressive disclosure
- No clear workflow progression

The owner's core frustration: **"The app is supposed to do all of this iteration forming. Instead I resorted to going back to Opus."**

## 5. Overridden Constraints from the Engineered Prompts

The original stage prompts contained these constraints that the owner explicitly overrode:

| Constraint                                             | Owner's Override                                                            |
| ------------------------------------------------------ | --------------------------------------------------------------------------- |
| "Backward-compatible changes only"                     | Clean rewrite allowed; v0.1 with 2 sessions and 1 library item              |
| "Storage evolution additive, do not delete or rewrite" | Rewrite where it produces cleaner result; write migration for existing data |
| "Don't add autosave unless it already exists"          | Add autosave - confirmed product decision                                   |
| "Keep frontend edits minimal"                          | Frontend types should match real domain model properly                      |
| "Add tests only if repo already uses them"             | Add pytest, unit tests, Playwright - testing is important                   |
| "No new features outside inspected plan"               | Git, testing, proper versioning are all in scope                            |
| "Preserve current repo behavior"                       | Session/draft semantics are broken and need changing                        |
| "Don't add features, don't widen scope"                | This is a new build, design for where you're going                          |

## 6. Status of plan1.txt

The owner has rewritten plan1.txt on 2026-03-08 with detailed amendments. Key context:

- It was originally generated through the app as an experiment to see if the process works
- The owner has now revised it with specific behavioral requirements and corrections
- It is a useful reference for UX direction (progressive disclosure, ADHD-friendly design, workflow ordering)
- The product direction and UX principles are right
- Specific implementation details have been amended by the owner inline
- The plan should be treated as quality input, qualified by the user, but not gospel

## 7. Intent Reformulation Flow (New, from plan1.txt amendments)

The owner added a new step to the intent stage that does not exist in the current codebase:

1. User writes task in their own words
2. System sends to GPT 5.4 to articulate better: reformat, make coherent, separate different subjects for clearer iteration
3. User accepts changes; original input is archived, reformatted version becomes the new editable input
4. When ready, user submits for clarifying questions
5. GPT 5.4 generates clarifying questions with free text option for each, plus option to skip or request further rounds
6. User answers and submits; questions collapse into expandable summary
7. Model recommendation appears; user accepts or overrides from dropdown
8. On model selection, compilation begins

This is a significant addition to the current architecture. The clarifier currently goes straight from raw intent to questions; there is no reformulation step.

## 8. Additional Task Types (Future)

Beyond the day-one set of `refactor | frontend | audit | implement`, the owner wants these defined but not yet built:

- `Plan` - Design or spec work
- `Bugfix` - Fix broken behavior
- `Test` - Write or improve tests
- `Commit` - Prepare commit messages or PR descriptions
- `Simplify` - Reduce complexity without changing behavior

## 9. Code Quality Standards

The owner specified these coding principles for all implementation:

- No god components, no god files
- Use helpers and separation of concerns
- Don't couple things unnecessarily
- Write boring code, don't be clever
- Include a way for every agent to review their own work:
  - Include instructions to confirm UI changes in the browser
  - Write tests before features and iterate until done
  - Use rubrics for quality verification

## 10. Execution Plan and Status

**Phase 1: Foundation — COMPLETE (2026-03-08)**

- Git init + .gitignore + initial commit
- Clean domain model rewrite (models.py) with proper draft/session/library/version concepts
- Backend endpoint updates
- Data migration utility for existing JSON files
- pytest test suite for backend (61 tests)
- Updated frontend types to match
- Handoff doc: `docs/phase1-handoff.md`

**Phase 2: UI Restructure — COMPLETE (2026-03-08)**

- Backend audit fixes: shared OpenAI client, async harvester, tightened CORS, sanitized errors
- CSS design tokens + dark mode with ThemeSwitcher
- Navigation shell: global header, icon-based sidebar nav, collapsible session section
- API client alignment (getSession, verified types)
- Progressive disclosure workflow engine: 6-stage Workbench rewrite with stage gating
- 7 stage components: WorkflowStage, ContextStage, IntentStage, ClarifyStage, ModelStage, CompileStage, SaveStage
- Copy rewrite: all jargon replaced with plain/technical-with-explanation tone
- Frontend unit tests: vitest + testing-library, 36 tests
- Total tests: 67 backend + 36 frontend = 103
- Handoff doc: `docs/phase2-handoff.md`

**Phase 3: End-to-End Flows — NOT STARTED**

- Autosave implementation (at stage transitions — framework exists, needs wiring)
- Draft restore (repopulate all visible state from session)
- Version history (decimal versioning 3.01, 3.02 — currently integer bumps)
- Revision lineage (iterate from previous version)
- Intent reformulation step (GPT 5.4 articulates task before clarification)
- Library save flow refinement
- Dark mode for Library.tsx and Projects.tsx (still use static @theme palette classes)
- Wire sidebar session section to actual session state
- Playwright E2E tests
- Final handoff doc

## 11. Technical Decisions (Current State)

1. **OpenAI is the AI provider** for all backend intelligence (clarifier, compiler, router). The OpenAI `responses` API is used (not chat completions). A shared thread-safe singleton client is used across all modules (`backend/openai_client.py`).
2. **File-based persistence** with atomic writes (write to .tmp, rename). No database.
3. **No authentication** - single-user local app.
4. **CORS restricted** to explicit localhost origins (ports 3000, 3005, 5173).
5. **The compiler reads kernel/models/\*.md** at startup (cached with lru_cache) and injects model-specific knowledge into compilation prompts.
6. **Router uses structured output** (OpenAI's `responses.parse`) to get typed model recommendations.
7. **Clarifier uses structured output** to get typed question sets.
8. **Frontend uses progressive disclosure** — Workbench.tsx (~637 lines) orchestrates 7 stage components. No state management library (useState only).
9. **No URL-based routing** - page switching is via useState in App.tsx.
10. **CSS design token system** with light/dark mode via CSS custom properties and `[data-theme]` attribute.
11. **Harvester runs in thread pool** (`asyncio.to_thread`) to avoid blocking the FastAPI event loop.
12. **AI error messages sanitized** to prevent API key leaks in HTTP responses.
