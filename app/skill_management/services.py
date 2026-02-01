from __future__ import annotations

import base64
import json
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Optional

from fastapi import HTTPException

from app.skill_management.schemas import (
    AgentPromptVersionDetail,
    AgentPromptVersionSummary,
    SkillFileContent,
    SkillFileNode,
    SkillSummary,
)


_SAFE_NAME_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def skills_root_dir() -> Path:
    return _project_root() / "app" / "agentic" / "skills"


def prompts_root_dir() -> Path:
    return _project_root() / "app" / "agentic" / "agent_prompts"


def agents_root_dir() -> Path:
    return _project_root() / "app" / "agentic" / "agents"


def _ensure_safe_id(value: str, label: str) -> str:
    if not _SAFE_NAME_RE.match(value):
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
        if skill_md_path.exists():
            try:
                raw = skill_md_path.read_text(encoding="utf-8", errors="replace")
                name, description = _parse_skill_frontmatter(raw)
            except Exception:
                name = ""
                description = ""
        results.append(
            SkillSummary(
                id=skill_id,
                name=name or skill_id,
                description=description or "",
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
    _ensure_safe_id(skill_id, "skill_id")
    root = skills_root_dir() / skill_id
    if not root.exists() or not root.is_dir():
        raise HTTPException(status_code=404, detail="skill_not_found")

    root_resolved = root.resolve()
    nodes_emitted = 0

    def walk_dir(dir_path: Path, rel_prefix: Path) -> list[SkillFileNode]:
        nonlocal nodes_emitted
        if nodes_emitted >= max_nodes:
            return []
        items: list[SkillFileNode] = []
        for entry in sorted(dir_path.iterdir(), key=lambda p: (p.is_file(), p.name)):
            if entry.name.startswith("."):
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
    _ensure_safe_id(skill_id, "skill_id")
    base = skills_root_dir() / skill_id
    if not base.exists() or not base.is_dir():
        raise HTTPException(status_code=404, detail="skill_not_found")

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
    _ensure_safe_id(skill_id, "skill_id")
    base = skills_root_dir() / skill_id
    if not base.exists() or not base.is_dir():
        raise HTTPException(status_code=404, detail="skill_not_found")

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
    _ensure_safe_id(skill_id, "skill_id")
    base = skills_root_dir() / skill_id
    abs_path = _resolve_under(base, relative_path)
    if not abs_path.exists():
        return
    if abs_path.is_dir():
        # avoid deleting skill root itself
        if abs_path.resolve() == base.resolve():
            raise HTTPException(status_code=400, detail="cannot_delete_skill_root")
        for child in sorted(abs_path.rglob("*"), reverse=True):
            if child.is_file() or child.is_symlink():
                child.unlink(missing_ok=True)
            elif child.is_dir():
                try:
                    child.rmdir()
                except OSError:
                    pass
        abs_path.rmdir()
    else:
        abs_path.unlink(missing_ok=True)


def rename_skill_path(skill_id: str, old_relative_path: str, new_relative_path: str) -> None:
    _ensure_safe_id(skill_id, "skill_id")
    base = skills_root_dir() / skill_id
    src = _resolve_under(base, old_relative_path)
    dst = _resolve_under(base, new_relative_path)
    if not src.exists():
        raise HTTPException(status_code=404, detail="source_not_found")
    dst.parent.mkdir(parents=True, exist_ok=True)
    src.rename(dst)


def mkdir_skill_path(skill_id: str, relative_path: str) -> None:
    _ensure_safe_id(skill_id, "skill_id")
    base = skills_root_dir() / skill_id
    abs_path = _resolve_under(base, relative_path)
    abs_path.mkdir(parents=True, exist_ok=True)


def list_agents() -> list[str]:
    # Skill management page is intended to debug a dedicated Claude Agent SDK agent,
    # not the legacy Agno-based agents under app/agentic/agents.
    return ["skill-management"]


def _prompt_version_dir(agent_id: str, version: str) -> Path:
    _ensure_safe_id(agent_id, "agent_id")
    _ensure_safe_id(version, "prompt_version")
    return prompts_root_dir() / agent_id / version


def list_prompt_versions(agent_id: str) -> list[AgentPromptVersionSummary]:
    _ensure_safe_id(agent_id, "agent_id")
    root = prompts_root_dir() / agent_id
    if not root.exists():
        return []
    versions: list[AgentPromptVersionSummary] = []
    for version_dir in sorted(root.iterdir(), key=lambda p: p.name):
        if not version_dir.is_dir():
            continue
        meta_path = version_dir / "meta.json"
        prompt_path = version_dir / "prompt.md"
        if not meta_path.exists() or not prompt_path.exists():
            continue
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            created_at = datetime.fromisoformat(meta["created_at"])
            updated_at = datetime.fromisoformat(meta["updated_at"])
            lang = meta.get("lang", "zh-CN")
            active_skill_ids = meta.get("active_skill_ids", []) or []
            versions.append(
                AgentPromptVersionSummary(
                    agent_id=agent_id,
                    version=version_dir.name,
                    lang=lang,
                    active_skill_ids=list(active_skill_ids),
                    created_at=created_at,
                    updated_at=updated_at,
                )
            )
        except Exception:
            continue
    return versions


def get_prompt_version(agent_id: str, version: str) -> AgentPromptVersionDetail:
    version_dir = _prompt_version_dir(agent_id, version)
    meta_path = version_dir / "meta.json"
    prompt_path = version_dir / "prompt.md"
    if not meta_path.exists() or not prompt_path.exists():
        raise HTTPException(status_code=404, detail="prompt_version_not_found")
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    content = prompt_path.read_text(encoding="utf-8", errors="replace")
    return AgentPromptVersionDetail(
        agent_id=agent_id,
        version=version,
        lang=meta.get("lang", "zh-CN"),
        active_skill_ids=list(meta.get("active_skill_ids", []) or []),
        created_at=datetime.fromisoformat(meta["created_at"]),
        updated_at=datetime.fromisoformat(meta["updated_at"]),
        content=content,
    )


def create_prompt_version(agent_id: str, version: str, *, lang: str, content: str) -> AgentPromptVersionDetail:
    version_dir = _prompt_version_dir(agent_id, version)
    if version_dir.exists():
        raise HTTPException(status_code=409, detail="prompt_version_exists")
    version_dir.mkdir(parents=True, exist_ok=True)
    now = _now()
    (version_dir / "prompt.md").write_text(content or "", encoding="utf-8")
    (version_dir / "meta.json").write_text(
        json.dumps(
            {
                "agent_id": agent_id,
                "version": version,
                "lang": lang,
                "active_skill_ids": [],
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return get_prompt_version(agent_id, version)


def create_prompt_version_with_skills(
    agent_id: str, version: str, *, lang: str, content: str, active_skill_ids: list[str]
) -> AgentPromptVersionDetail:
    version_dir = _prompt_version_dir(agent_id, version)
    if version_dir.exists():
        raise HTTPException(status_code=409, detail="prompt_version_exists")
    version_dir.mkdir(parents=True, exist_ok=True)
    now = _now()
    (version_dir / "prompt.md").write_text(content or "", encoding="utf-8")
    (version_dir / "meta.json").write_text(
        json.dumps(
            {
                "agent_id": agent_id,
                "version": version,
                "lang": lang,
                "active_skill_ids": list(active_skill_ids or []),
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return get_prompt_version(agent_id, version)


def update_prompt_version(agent_id: str, version: str, *, lang: Optional[str], content: Optional[str]) -> AgentPromptVersionDetail:
    version_dir = _prompt_version_dir(agent_id, version)
    meta_path = version_dir / "meta.json"
    prompt_path = version_dir / "prompt.md"
    if not meta_path.exists() or not prompt_path.exists():
        raise HTTPException(status_code=404, detail="prompt_version_not_found")
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    if lang is not None:
        meta["lang"] = lang
    if content is not None:
        prompt_path.write_text(content, encoding="utf-8")
    meta["updated_at"] = _now().isoformat()
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    return get_prompt_version(agent_id, version)


def update_prompt_version_with_skills(
    agent_id: str,
    version: str,
    *,
    lang: Optional[str],
    content: Optional[str],
    active_skill_ids: Optional[list[str]],
) -> AgentPromptVersionDetail:
    version_dir = _prompt_version_dir(agent_id, version)
    meta_path = version_dir / "meta.json"
    prompt_path = version_dir / "prompt.md"
    if not meta_path.exists() or not prompt_path.exists():
        raise HTTPException(status_code=404, detail="prompt_version_not_found")
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    if lang is not None:
        meta["lang"] = lang
    if content is not None:
        prompt_path.write_text(content, encoding="utf-8")
    if active_skill_ids is not None:
        meta["active_skill_ids"] = list(active_skill_ids)
    meta["updated_at"] = _now().isoformat()
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    return get_prompt_version(agent_id, version)


def delete_prompt_version(agent_id: str, version: str) -> None:
    version_dir = _prompt_version_dir(agent_id, version)
    if not version_dir.exists():
        return
    for child in sorted(version_dir.rglob("*"), reverse=True):
        if child.is_file() or child.is_symlink():
            child.unlink(missing_ok=True)
        elif child.is_dir():
            try:
                child.rmdir()
            except OSError:
                pass
    try:
        version_dir.rmdir()
    except OSError:
        pass


def build_system_prompt_with_skills(prompt: str, skill_ids: Iterable[str]) -> str:
    chunks = [prompt.rstrip()]
    root = skills_root_dir()
    for skill_id in skill_ids:
        _ensure_safe_id(skill_id, "skill_id")
        skill_md = root / skill_id / "SKILL.md"
        if not skill_md.exists():
            continue
        raw = skill_md.read_text(encoding="utf-8", errors="replace")
        chunks.append(f"\n\n# Skill: {skill_id}\n\n{raw}\n")
    return "\n".join(chunks).strip() + "\n"
