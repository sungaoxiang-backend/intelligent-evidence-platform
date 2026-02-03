from __future__ import annotations

import base64
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import HTTPException

from app.skill_management.schemas import (
    SkillFileContent,
    SkillFileNode,
    SkillMeta,
    SkillStatus,
    SkillSummary,
    SkillVersionSummary,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def skills_root_dir() -> Path:
    return _project_root() / "app" / "agentic" / "skills"


def _ensure_safe_id(value: str, label: str) -> str:
    # Basic validation for directory names
    if not value or ".." in value or "/" in value or "\\" in value:
        raise HTTPException(status_code=400, detail=f"invalid_{label}")
    return value


def _resolve_under(base: Path, relative_path: str) -> Path:
    rel = Path(relative_path)
    if rel.is_absolute():
        raise HTTPException(status_code=400, detail="path_must_be_relative")
    resolved = (base / rel).resolve()
    base_resolved = base.resolve()
    if not resolved.is_relative_to(base_resolved):
        raise HTTPException(status_code=400, detail="path_outside_root")
    return resolved


def _get_skill_dir(skill_id: str) -> Path:
    _ensure_safe_id(skill_id, "skill_id")
    root = skills_root_dir() / skill_id
    if not root.exists() or not root.is_dir():
        raise HTTPException(status_code=404, detail="skill_not_found")
    return root


def _parse_skill_frontmatter(skill_md: str) -> tuple[str, str]:
    lines = skill_md.splitlines()
    if len(lines) < 3 or lines[0].strip() != "---":
        return "", ""
    try:
        end_idx = lines.index("---", 1)
    except ValueError:
        return "", ""
    name = ""
    description = ""
    for line in lines[1:end_idx]:
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        key = key.strip().lower()
        value = value.strip().strip('"').strip("'")
        if key == "name":
            name = value
        elif key == "description":
            description = value
    return name, description


def _read_skill_meta(skill_id: str) -> SkillMeta:
    skill_dir = _get_skill_dir(skill_id)
    meta_path = skill_dir / "skill.meta.json"
    if not meta_path.exists():
        return SkillMeta()
    try:
        data = json.loads(meta_path.read_text(encoding="utf-8"))
        return SkillMeta(**data)
    except Exception:
        return SkillMeta()


def _save_skill_meta(skill_id: str, meta: SkillMeta) -> None:
    skill_dir = _get_skill_dir(skill_id)
    meta_path = skill_dir / "skill.meta.json"
    meta_path.write_text(
        meta.model_dump_json(indent=2, exclude_none=True), encoding="utf-8"
    )


def list_skills(query: str | None = None) -> list[SkillSummary]:
    root = skills_root_dir()
    if not root.exists():
        return []

    results: list[SkillSummary] = []
    for child in sorted(root.iterdir(), key=lambda p: p.name):
        if not child.is_dir():
            continue
        skill_id = child.name
        skill_md_path = child / "SKILL.md"
        name = ""
        description = ""
        
        # Read basic info from SKILL.md
        if skill_md_path.exists():
            try:
                raw = skill_md_path.read_text(encoding="utf-8", errors="replace")
                name, description = _parse_skill_frontmatter(raw)
            except Exception:
                name = ""
                description = ""
        
        # Read status from meta
        meta = _read_skill_meta(skill_id)
        
        # Determine updated_at
        updated_at = None
        try:
            st = child.stat()
            updated_at = datetime.fromtimestamp(st.st_mtime, tz=timezone.utc)
        except Exception:
            pass

        results.append(
            SkillSummary(
                id=skill_id,
                name=name or skill_id,
                description=description or "",
                status=meta.status,
                updated_at=updated_at,
            )
        )

    if query:
        q = query.strip().lower()
        results = [
            s
            for s in results
            if q in s.id.lower() or q in s.name.lower() or q in s.description.lower()
        ]
    return results


def skill_tree(skill_id: str, max_nodes: int = 4000) -> SkillFileNode:
    root = _get_skill_dir(skill_id)
    root_resolved = root.resolve()
    nodes_emitted = 0

    def walk_dir(dir_path: Path, rel_prefix: Path) -> list[SkillFileNode]:
        nonlocal nodes_emitted
        if nodes_emitted >= max_nodes:
            return []
        items: list[SkillFileNode] = []
        for entry in sorted(dir_path.iterdir(), key=lambda p: (p.is_file(), p.name)):
            # Skip hidden files and directories (like .versions, .git, .DS_Store), but keep skill.meta.json if needed (or hide it?)
            # Let's hide .versions and .git, but maybe show skill.meta.json for debugging? 
            # Ideally users shouldn't edit skill.meta.json manually. Hiding it is better.
            if entry.name.startswith(".") or entry.name == "skill.meta.json":
                continue
            
            try:
                resolved = entry.resolve()
            except FileNotFoundError:
                continue
            if not resolved.is_relative_to(root_resolved):
                continue
            
            rel_path = (rel_prefix / entry.name).as_posix()
            try:
                st = entry.stat()
                updated_at = datetime.fromtimestamp(st.st_mtime, tz=timezone.utc)
            except Exception:
                updated_at = None
                st = None
            
            if entry.is_dir() and not entry.is_symlink():
                children = walk_dir(entry, rel_prefix / entry.name)
                items.append(
                    SkillFileNode(
                        path=rel_path,
                        type="dir",
                        updated_at=updated_at,
                        children=children,
                    )
                )
            elif entry.is_file():
                size = None
                if st is not None:
                    size = int(st.st_size)
                items.append(
                    SkillFileNode(
                        path=rel_path,
                        type="file",
                        size=size,
                        updated_at=updated_at,
                    )
                )
            nodes_emitted += 1
            if nodes_emitted >= max_nodes:
                break
        return items

    children = walk_dir(root, Path(""))
    return SkillFileNode(path="", type="dir", children=children)


def read_skill_file(skill_id: str, relative_path: str, max_bytes: int = 2 * 1024 * 1024) -> SkillFileContent:
    base = _get_skill_dir(skill_id)
    abs_path = _resolve_under(base, relative_path)
    if not abs_path.exists() or not abs_path.is_file():
        raise HTTPException(status_code=404, detail="file_not_found")

    size = abs_path.stat().st_size
    if size > max_bytes:
        raise HTTPException(status_code=413, detail="file_too_large")

    raw = abs_path.read_bytes()
    try:
        text = raw.decode("utf-8")
        return SkillFileContent(path=relative_path, is_binary=False, content=text)
    except UnicodeDecodeError:
        return SkillFileContent(
            path=relative_path,
            is_binary=True,
            content_base64=base64.b64encode(raw).decode("ascii"),
        )


def write_skill_file(skill_id: str, relative_path: str, *, is_binary: bool, content: str | None, content_base64: str | None) -> None:
    base = _get_skill_dir(skill_id)
    abs_path = _resolve_under(base, relative_path)
    abs_path.parent.mkdir(parents=True, exist_ok=True)

    if is_binary:
        if not content_base64:
            raise HTTPException(status_code=400, detail="missing_content_base64")
        try:
            data = base64.b64decode(content_base64)
        except Exception as e:
            raise HTTPException(status_code=400, detail="invalid_base64") from e
        abs_path.write_bytes(data)
        return

    abs_path.write_text(content or "", encoding="utf-8")


def delete_skill_path(skill_id: str, relative_path: str) -> None:
    base = _get_skill_dir(skill_id)
    abs_path = _resolve_under(base, relative_path)
    if not abs_path.exists():
        return
    if abs_path.is_dir():
        # avoid deleting skill root itself
        if abs_path.resolve() == base.resolve():
            raise HTTPException(status_code=400, detail="cannot_delete_skill_root")
        shutil.rmtree(abs_path)
    else:
        abs_path.unlink(missing_ok=True)


def rename_skill_path(skill_id: str, old_relative_path: str, new_relative_path: str) -> None:
    base = _get_skill_dir(skill_id)
    src = _resolve_under(base, old_relative_path)
    dst = _resolve_under(base, new_relative_path)
    if not src.exists():
        raise HTTPException(status_code=404, detail="source_not_found")
    dst.parent.mkdir(parents=True, exist_ok=True)
    src.rename(dst)


def mkdir_skill_path(skill_id: str, relative_path: str) -> None:
    base = _get_skill_dir(skill_id)
    abs_path = _resolve_under(base, relative_path)
    abs_path.mkdir(parents=True, exist_ok=True)


# --- Meta & Versioning ---

def get_skill_meta(skill_id: str) -> SkillMeta:
    return _read_skill_meta(skill_id)


def update_skill_status(skill_id: str, status: SkillStatus) -> SkillMeta:
    meta = _read_skill_meta(skill_id)
    meta.status = status
    _save_skill_meta(skill_id, meta)
    return meta


def create_skill_version(skill_id: str, message: str) -> SkillVersionSummary:
    skill_dir = _get_skill_dir(skill_id)
    versions_dir = skill_dir / ".versions"
    versions_dir.mkdir(exist_ok=True)
    
    # Generate version ID (timestamp)
    now = _now()
    version_id = now.strftime("v_%Y%m%d%H%M%S")
    version_path = versions_dir / version_id
    
    # Create snapshot
    # Copy everything except .versions and .git
    def ignore_patterns(path, names):
        if path == str(skill_dir):
            return {".versions", ".git", ".DS_Store", "__pycache__"}
        return {".DS_Store", "__pycache__"}

    shutil.copytree(skill_dir, version_path, ignore=ignore_patterns)

    # Update meta
    meta = _read_skill_meta(skill_id)
    version_summary = SkillVersionSummary(
        version=version_id,
        message=message,
        created_at=now
    )
    # Insert at beginning
    meta.versions.insert(0, version_summary)
    _save_skill_meta(skill_id, meta)
    
    return version_summary


def list_skill_versions(skill_id: str) -> list[SkillVersionSummary]:
    meta = _read_skill_meta(skill_id)
    return meta.versions


def restore_skill_version(skill_id: str, version_id: str) -> None:
    skill_dir = _get_skill_dir(skill_id)
    version_path = skill_dir / ".versions" / version_id
    
    if not version_path.exists():
        raise HTTPException(status_code=404, detail="version_not_found")
        
    # Safety check: Snapshot existence
    if not version_path.is_dir():
        raise HTTPException(status_code=400, detail="invalid_version_snapshot")

    # Clean current directory (except .versions, .git, skill.meta.json)
    # We want to keep metadata history even if we restore files
    for child in skill_dir.iterdir():
        if child.name in [".versions", ".git", "skill.meta.json"]:
            continue
        if child.is_dir():
            shutil.rmtree(child)
        else:
            child.unlink()
            
    # Copy from snapshot
    for child in version_path.iterdir():
        if child.name == "skill.meta.json":
            # Don't overwrite meta from snapshot, we keep current meta history
            continue
            
        dest = skill_dir / child.name
        if child.is_dir():
            shutil.copytree(child, dest)
        else:
            shutil.copy2(child, dest)
            
    # Note: We do not change the 'versions' list in meta. Restoring is just an action.
    # Optionally we could record a new version "Restored from X". But for now, just overwriting files is enough.

