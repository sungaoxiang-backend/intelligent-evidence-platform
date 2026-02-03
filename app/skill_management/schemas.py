from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class SkillStatus(str, Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"


class SkillSummary(BaseModel):
    id: str
    name: str = ""
    description: str = ""
    status: SkillStatus = SkillStatus.DRAFT
    updated_at: Optional[datetime] = None


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


class SkillVersionSummary(BaseModel):
    version: str
    message: str = ""
    created_at: datetime


class CreateSkillVersionRequest(BaseModel):
    message: str = ""


class UpdateSkillStatusRequest(BaseModel):
    status: SkillStatus


class SkillMeta(BaseModel):
    status: SkillStatus = SkillStatus.DRAFT
    versions: list[SkillVersionSummary] = Field(default_factory=list)

