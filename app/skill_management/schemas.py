from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class SkillSummary(BaseModel):
    id: str
    name: str = ""
    description: str = ""


class SkillFileNode(BaseModel):
    path: str = Field(..., description="Path relative to skill root")
    type: Literal["file", "dir"]
    size: Optional[int] = None
    updated_at: Optional[datetime] = None
    children: Optional[list["SkillFileNode"]] = None


class SkillFileContent(BaseModel):
    path: str
    is_binary: bool = False
    content: Optional[str] = None
    content_base64: Optional[str] = None


class SaveSkillFileRequest(BaseModel):
    is_binary: bool = False
    content: Optional[str] = None
    content_base64: Optional[str] = None


class SkillBatchOp(BaseModel):
    op: Literal["delete", "rename", "mkdir", "create_file"]
    path: str
    new_path: Optional[str] = None
    is_binary: bool = False
    content: Optional[str] = None
    content_base64: Optional[str] = None


class SkillBatchOpsRequest(BaseModel):
    ops: list[SkillBatchOp] = Field(default_factory=list)


class AgentSummary(BaseModel):
    id: str


class AgentPromptVersionSummary(BaseModel):
    agent_id: str
    version: str
    lang: str = "zh-CN"
    active_skill_ids: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class AgentPromptVersionDetail(AgentPromptVersionSummary):
    content: str


class CreatePromptVersionRequest(BaseModel):
    version: str
    lang: str = "zh-CN"
    content: str = ""
    active_skill_ids: list[str] = Field(default_factory=list)


class UpdatePromptVersionRequest(BaseModel):
    lang: Optional[str] = None
    content: Optional[str] = None
    active_skill_ids: Optional[list[str]] = None


class PlaygroundRunRequest(BaseModel):
    agent_id: str
    prompt_version: str
    skill_ids: list[str] = Field(default_factory=list)
    message: str
    model: Optional[str] = None
    max_turns: int = 1


class PlaygroundRunResponse(BaseModel):
    output: str = ""
    session_id: Optional[str] = None
    total_cost_usd: Optional[float] = None
    raw: Optional[dict[str, Any]] = None
