# Phase 4 Design — Versioning, Sessions, Library, Storage

> Written 2026-03-08. Captures owner decisions from the Phase 3 review conversation.
> This document replaces any prior assumptions about versioning in project-context.md.

---

## 1. The Version Number Scheme

Every prompt-building session has a **session number** (a monotonically increasing integer, never reused even if the session is deleted — see Storage section). All prompt versions within that session use the session number as their major.

```
{session_number}.{version_path}

e.g.  7.01    — session 7, version 1 (reformulated intent)
      7.02    — session 7, version 2 (first compile)
      7.021   — session 7, branch off 7.02, version 1
      7.0211  — session 7, branch off 7.021, version 1
```

### 1.1 The version path

The version path is a dot-free decimal string that encodes the tree position. It reads as a sequence of digits where each additional digit represents a level deeper in the branch tree.

| Version path | Meaning                                     |
| ------------ | ------------------------------------------- |
| `01`         | Main branch, step 1 (first change from raw) |
| `02`         | Main branch, step 2                         |
| `07`         | Main branch, step 7                         |
| `021`        | Branch off step 2, first edit               |
| `022`        | Branch off step 2, second edit              |
| `0211`       | Branch off 021, first edit                  |

### 1.2 The raw prompt is version zero

`7.0` (or just "session 7") is the user's original unmodified input. It is not stored as a versioned artifact — it is the session's `rough_intent` field. It appears in the version history UI as the starting point but is not a separate saved version.

### 1.3 What triggers a new version

| Event                                                   | Triggers new version?                                       |
| ------------------------------------------------------- | ----------------------------------------------------------- |
| User submits raw intent                                 | No — this is `session.rough_intent`, shown as `.0`          |
| Reformulation accepted                                  | **Yes → next decimal on current branch**                    |
| Compile                                                 | **Yes → next decimal on current branch**                    |
| User edits the reformulated or compiled prompt directly | **Yes → next decimal on current branch**                    |
| User answers clarifying questions                       | **No** — questions do not change the prompt                 |
| User changes model and recompiles                       | **Yes → next decimal (the new compile is the new version)** |
| User rolls back to an earlier version and compiles      | **Yes → new branch (adds a digit level)**                   |

### 1.4 Branching

Rolling back to a prior version and making a change creates a branch — an additional digit is appended to the current version path.

Example:

```
Session 3 history:
  3.0    raw intent
  3.01   reformulated
  3.02   first compile
  3.03   recompile with different model   ← user goes back to 3.02
  3.021  branch: user edits 3.02, compiles        ← branch starts here
  3.022  user compiles again from 3.021
  3.023  user compiles again               ← user goes back to 3.022
  3.0221 branch off 3.022
```

When the user is viewing `3.03` and goes back to `3.022`, all versions from `3.023` onward are still visible in the history (linear history is non-destructive). The next action from `3.022` creates `3.0221`, not `3.024`.

### 1.5 Branch depth limit

Maximum branching depth: **3 levels below the main branch.** This means version paths can have at most 5 digits (e.g. `02111`). If the user tries to branch from a depth-3 node, they must start a new session instead.

The UI should communicate this clearly: "You've reached the maximum version depth for this prompt. Start a new session to continue iterating."

---

## 2. Session Model

### 2.1 Session identity

Sessions use a **UUID** for internal references (stable across deletions, safe for API URLs). They also carry a **session_number** (autoincrement integer, assigned on creation, never reused). The session_number is the human-readable major in the version label.

### 2.2 What a session stores

A session is the complete record of a prompt-building task from raw intent through all compiled versions.

| Field            | Type      | Notes                                              |
| ---------------- | --------- | -------------------------------------------------- |
| `id`             | UUID      | Internal stable identifier                         |
| `session_number` | int       | Human-readable major (autoincrement, never reused) |
| `project_id`     | UUID      | Which project this was for                         |
| `task_type`      | enum      | refactor / frontend / audit / implement            |
| `rough_intent`   | string    | The user's original unedited input                 |
| `status`         | enum      | open / closed                                      |
| `created_at`     | datetime  |                                                    |
| `updated_at`     | datetime  |                                                    |
| `versions`       | Version[] | Ordered list of all version nodes (see below)      |

### 2.3 Version node (stored per version)

Each node in the version tree is a stored record:

| Field                  | Type           | Notes                                                      |
| ---------------------- | -------------- | ---------------------------------------------------------- |
| `id`                   | UUID           |                                                            |
| `session_id`           | UUID           | Parent session                                             |
| `version_label`        | string         | e.g. `7.021`                                               |
| `parent_version_label` | string or null | `7.02` for a branch node; null for first version           |
| `prompt_text`          | string         | The prompt text at this version (reformulated or compiled) |
| `target_model`         | enum or null   | Null for reformulation; set for compiled versions          |
| `version_type`         | enum           | `reformulation` / `compile` / `edit`                       |
| `created_at`           | datetime       |                                                            |

Clarifying questions and answers are **not** stored per version — they are not versioned artifacts. The user answers questions and may incorporate them by editing the prompt, which creates a new version.

---

## 3. Library Model

### 3.1 What the library stores

The library is a curated collection of prompts the user explicitly saves. It stores only what is needed to use the prompt again:

| Field                        | Type           | Notes                                     |
| ---------------------------- | -------------- | ----------------------------------------- |
| `id`                         | UUID           |                                           |
| `session_id`                 | UUID           | The session this came from                |
| `version_label`              | string         | Which version was saved (e.g. `7.03`)     |
| `title`                      | string         | User-supplied or auto-derived from intent |
| `prompt_text`                | string         | The compiled prompt text                  |
| `target_model`               | enum           | The model this prompt is written for      |
| `effectiveness_rating`       | int (1-7)      | Optional                                  |
| `expected_result_assessment` | string or null | Optional                                  |
| `created_at`                 | datetime       | When saved to library                     |

The library does **not** store: clarifying questions, original intent, reformulated intent, intermediate versions, or the version tree. Only the final prompt and its audience model.

### 3.2 When saving to library

- The user explicitly clicks "Save to library" (never automatic).
- The library entry captures the **current version** at the moment of saving.
- Multiple versions of the same session can be saved separately (e.g. the same task compiled for Sonnet and for GPT-5.4 — two library entries, same session).
- Library entries persist **indefinitely** (no automatic pruning).

---

## 4. Retention Policy

### Sessions (not in library)

| Age       | What happens                              |
| --------- | ----------------------------------------- |
| 0–90 days | Full version tree preserved               |
| > 90 days | Session and all versions deleted entirely |

### Sessions (in library)

When a session has at least one library save, after 90 days:

- The version tree is pruned: all version nodes are deleted **except the most recently updated one**.
- The session record itself is retained (for the library reference).
- The surviving version node is the one with the latest `updated_at`.

### Library entries

Library entries are permanent until the user explicitly deletes them.

---

## 5. Storage Recommendation

### Current state

Flat JSON files in `data/`. Works for a v0.1 single-user app but becomes fragile with tree-structured versioning, pruning queries, and relational lookups (sessions ↔ versions ↔ library).

### Recommendation: SQLite via SQLAlchemy

**Why SQLite:**

- Local, single-file database — no server, no cloud account, no network dependency
- Native Python support (`sqlite3`) + clean ORM via SQLAlchemy
- Handles relational structure (parent_version_label, session ↔ library joins) cleanly
- Autoincrement primary keys solve the session_number uniqueness problem even across deletions
- Trivial to backup (copy one file)
- Appropriate scale for a personal single-user tool

**Why not the alternatives:**

- **Neon (PostgreSQL cloud)** — requires internet, requires account, adds external dependency to a local tool
- **Convex** — excellent for multi-user reactive apps (you use it on other projects), overkill for a local single-user tool with no real-time sync requirement
- **MySQL** — requires a running local server process, heavier than needed
- **IndexedDB** — browser-only, incompatible with the Python backend

### Migration path

1. Replace `ProjectRegistry`, `SessionStore`, `PromptLibraryStore` (currently file-based JSON stores in `backend/main.py`) with SQLAlchemy models and a SQLite database (`data/prompt_os.db`).
2. Write a migration script that reads existing JSON files and inserts into the new schema.
3. The API surface (endpoints) stays the same — only the storage layer changes.

---

## 6. Open Questions (to resolve before Phase 4 implementation)

1. **Session number display vs. UUID.** The session UUID is used in API URLs. The session_number is human-readable for version labels. Are both needed in the UI, or just the session_number?

2. **Branch depth enforcement.** When the user is at depth 3 and tries to iterate, should the UI disable the iteration controls and explain why? Or silently prompt them to start a new session?

3. **Version history UI.** The version tree is non-linear (it branches). How should it be displayed — as a flat list sorted by `created_at`, or as an indented tree? A flat list sorted by time is simpler but may be confusing when branches exist.

4. **Library entry naming.** Auto-derive from `rough_intent` (first sentence, truncated) or require the user to name it? Current behavior: auto-derive, user can edit before saving. Confirm this is still the intent.

5. **Pruning trigger.** Is the 90-day pruning run on a schedule (cron, app startup), or triggered on-demand? For a local tool with no always-on server, on-startup pruning is simplest.
