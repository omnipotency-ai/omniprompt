from __future__ import annotations

import ast
import json
import re
from datetime import datetime, timezone
from pathlib import Path

try:
    from backend.models import RepoMap, RepoMapFile
except ModuleNotFoundError:
    from models import RepoMap, RepoMapFile

IGNORED_DIRS = {
    ".git",
    ".hg",
    ".idea",
    ".mypy_cache",
    ".next",
    ".pytest_cache",
    ".ruff_cache",
    ".svn",
    ".venv",
    "__pycache__",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "venv",
}
CODE_EXTENSIONS = {".py", ".ts", ".tsx", ".js", ".jsx"}
MAX_CODE_FILE_BYTES = 512_000
EXPORT_PATTERN = re.compile(
    r"^\s*export\s+(?:default\s+)?(?:async\s+)?"
    r"(?:function|const|let|var|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)",
    re.MULTILINE,
)
EXPORT_LIST_PATTERN = re.compile(r"^\s*export\s*{\s*([^}]+)\s*}", re.MULTILINE)


def harvest_project(project_id: str, project_name: str, project_path: Path, maps_dir: Path) -> RepoMap:
    root_path = project_path.expanduser().resolve()
    files = _collect_files(root_path)
    tree_lines = _build_tree_lines(root_path)
    summary = _build_summary(project_name, root_path, tree_lines, files)
    repo_map = RepoMap(
        project_id=project_id,
        project_name=project_name,
        project_path=root_path.as_posix(),
        generated_at=datetime.now(timezone.utc),
        file_count=len(files),
        tree_lines=tree_lines,
        files=files,
        summary=summary,
    )
    maps_dir.mkdir(parents=True, exist_ok=True)
    output_path = maps_dir / f"{project_id}.json"
    _write_json(output_path, repo_map.model_dump(mode="json"))
    return repo_map


def _collect_files(root_path: Path) -> list[RepoMapFile]:
    files: list[RepoMapFile] = []
    for path in _walk_paths(root_path, root_path):
        if not path.is_file():
            continue
        relative_path = path.relative_to(root_path).as_posix()
        extension = path.suffix.lower() or None
        size_bytes = _safe_file_size(path)
        files.append(
            RepoMapFile(
                path=relative_path,
                extension=extension,
                language=_detect_language(extension),
                size_bytes=size_bytes,
                exports=_extract_exports(path, extension, size_bytes),
            )
        )
    return files


def _build_tree_lines(root_path: Path) -> list[str]:
    lines: list[str] = []
    _append_tree_lines(root_path, root_path, lines, depth=0)
    return lines


def _append_tree_lines(current_path: Path, root_path: Path, lines: list[str], depth: int) -> None:
    for child in _iter_children(current_path):
        if _should_skip(child, root_path):
            continue
        indent = "  " * depth
        label = child.name + ("/" if child.is_dir() else "")
        lines.append(f"{indent}{label}")
        if child.is_dir():
            _append_tree_lines(child, root_path, lines, depth + 1)


def _should_skip(path: Path, root_path: Path) -> bool:
    relative_parts = path.relative_to(root_path).parts if path != root_path else ()
    return any(part in IGNORED_DIRS for part in relative_parts)


def _sort_key(path: Path) -> tuple[int, str]:
    return (0 if path.is_dir() else 1, path.name.lower())


def _walk_paths(current_path: Path, root_path: Path) -> list[Path]:
    paths: list[Path] = []
    for child in _iter_children(current_path):
        if _should_skip(child, root_path):
            continue
        paths.append(child)
        if child.is_dir():
            paths.extend(_walk_paths(child, root_path))
    return paths


def _iter_children(path: Path) -> list[Path]:
    try:
        return sorted(path.iterdir(), key=_sort_key)
    except OSError:
        return []


def _safe_file_size(path: Path) -> int:
    try:
        return path.stat().st_size
    except OSError:
        return 0


def _detect_language(extension: str | None) -> str | None:
    if extension == ".py":
        return "python"
    if extension in {".ts", ".tsx"}:
        return "typescript"
    if extension in {".js", ".jsx"}:
        return "javascript"
    return None


def _extract_exports(path: Path, extension: str | None, size_bytes: int) -> list[str]:
    if extension not in CODE_EXTENSIONS or size_bytes > MAX_CODE_FILE_BYTES:
        return []

    try:
        source = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return []

    if extension == ".py":
        return _extract_python_exports(source)
    return _extract_javascript_exports(source)


def _extract_python_exports(source: str) -> list[str]:
    try:
        module = ast.parse(source)
    except SyntaxError:
        return []

    exports: list[str] = []
    for node in module.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and not node.name.startswith("_"):
            exports.append(node.name)
    return exports


def _extract_javascript_exports(source: str) -> list[str]:
    exports = {match.group(1) for match in EXPORT_PATTERN.finditer(source)}
    for match in EXPORT_LIST_PATTERN.finditer(source):
        members = [member.strip() for member in match.group(1).split(",")]
        for member in members:
            if " as " in member:
                _, alias = member.split(" as ", 1)
                exports.add(alias.strip())
            elif member:
                exports.add(member)
    if re.search(r"^\s*export\s+default\b", source, re.MULTILINE):
        exports.add("default")
    return sorted(exports)


def _build_summary(
    project_name: str, root_path: Path, tree_lines: list[str], files: list[RepoMapFile]
) -> str:
    sections = [
        f"Project: {project_name}",
        f"Root: {root_path.as_posix()}",
        "",
        "File tree:",
        *tree_lines,
        "",
        "Exports:",
    ]

    export_lines = [
        f"- {file.path}: {', '.join(file.exports)}"
        for file in files
        if file.exports
    ]
    if export_lines:
        sections.extend(export_lines)
    else:
        sections.append("- No exports detected.")

    return "\n".join(sections)


def _write_json(output_path: Path, payload: dict[str, object]) -> None:
    temp_path = output_path.with_name(f"{output_path.name}.tmp")
    temp_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    temp_path.replace(output_path)
