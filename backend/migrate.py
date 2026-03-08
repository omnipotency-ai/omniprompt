"""Migrate old-format session and library JSON files to the new domain model.

Usage:
    python backend/migrate.py

Idempotent: safe to run multiple times. Already-migrated files are left unchanged.
"""

from __future__ import annotations

import json
import os
import uuid
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
SESSIONS_DIR = DATA_DIR / "sessions"
LIBRARY_DIR = DATA_DIR / "library"


def migrate_session(data: dict) -> tuple[dict, list[str]]:
    """Transform a session dict in-place from old format to new format.

    Returns (data, list_of_changes).
    """
    changes: list[str] = []

    # --- task_type rename ---
    if data.get("task_type") == "frontend_iteration":
        data["task_type"] = "frontend"
        changes.append("task_type: frontend_iteration -> frontend")

    # --- clarify_rounds ---
    if "clarifying_questions" in data or "clarifying_answers" in data:
        old_questions = data.pop("clarifying_questions", [])
        old_answers = data.pop("clarifying_answers", [])

        if old_questions or old_answers:
            round_entry = {
                "id": str(uuid.uuid4()),
                "round_number": 1,
                "questions": old_questions,
                "answers": old_answers,
                "created_at": data.get("updated_at", data.get("created_at")),
            }
            data["clarify_rounds"] = [round_entry]
            changes.append("converted clarifying_questions/answers -> clarify_rounds")
        else:
            data["clarify_rounds"] = []
            changes.append("removed empty clarifying_questions/answers, set clarify_rounds=[]")

    # --- compiled_versions ---
    if "compile_result" in data:
        old_compile = data.pop("compile_result")
        if old_compile is not None:
            version_entry = {
                "id": str(uuid.uuid4()),
                "version_label": "1",
                "compiled_prompt": old_compile.get("compiled_prompt", ""),
                "target_model": old_compile.get("target_model", ""),
                "project_context_used": old_compile.get("project_context_used", False),
                "created_at": data.get("updated_at", data.get("created_at")),
            }
            data["compiled_versions"] = [version_entry]
            changes.append("converted compile_result -> compiled_versions")
        else:
            data["compiled_versions"] = []
            changes.append("compile_result was null, set compiled_versions=[]")

    # --- remove notes ---
    if "notes" in data:
        data.pop("notes")
        changes.append("removed notes field")

    # --- add new fields with defaults ---
    if "reformulated_intent" not in data:
        data["reformulated_intent"] = None
        changes.append("added reformulated_intent=null")

    if "selected_model" not in data:
        data["selected_model"] = None
        changes.append("added selected_model=null")

    return data, changes


def migrate_library_prompt(data: dict) -> tuple[dict, list[str]]:
    """Transform a library prompt dict from old format to new format.

    Returns (data, list_of_changes).
    """
    changes: list[str] = []

    # --- rename why_it_works -> expected_result_assessment ---
    if "why_it_works" in data:
        data["expected_result_assessment"] = data.pop("why_it_works")
        changes.append("renamed why_it_works -> expected_result_assessment")

    # --- add compiled_version_id ---
    if "compiled_version_id" not in data:
        data["compiled_version_id"] = None
        changes.append("added compiled_version_id=null")

    return data, changes


def atomic_write(path: Path, data: dict) -> None:
    """Write JSON to a .tmp file then atomically rename."""
    tmp_path = path.with_suffix(".json.tmp")
    tmp_path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    os.replace(str(tmp_path), str(path))


def migrate_directory(directory: Path, migrate_fn, label: str) -> int:
    """Migrate all JSON files in a directory using the given transform function."""
    if not directory.exists():
        print(f"  {label}: directory {directory} does not exist, skipping")
        return 0

    migrated = 0
    for json_file in sorted(directory.glob("*.json")):
        data = json.loads(json_file.read_text(encoding="utf-8"))
        data, changes = migrate_fn(data)
        if changes:
            atomic_write(json_file, data)
            print(f"  {json_file.name}: {', '.join(changes)}")
            migrated += 1
        else:
            print(f"  {json_file.name}: already up to date")

    return migrated


def main() -> None:
    print("=== Prompt OS Data Migration ===\n")

    print(f"Sessions ({SESSIONS_DIR}):")
    session_count = migrate_directory(SESSIONS_DIR, migrate_session, "sessions")

    print(f"\nLibrary ({LIBRARY_DIR}):")
    library_count = migrate_directory(LIBRARY_DIR, migrate_library_prompt, "library")

    print(f"\n--- Summary ---")
    print(f"Sessions migrated: {session_count}")
    print(f"Library prompts migrated: {library_count}")
    print("Done.")


if __name__ == "__main__":
    main()
