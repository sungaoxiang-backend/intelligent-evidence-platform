from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from loguru import logger

from app.core.deps import get_current_active_superuser
from app.core.response import ListResponse, SingleResponse
from app.staffs.models import Staff
from app.skill_management.schemas import (
    CreateSkillVersionRequest,
    SaveSkillFileRequest,
    SkillBatchOpsRequest,
    SkillFileContent,
    SkillFileNode,
    SkillMeta,
    SkillSummary,
    SkillVersionSummary,
    UpdateSkillStatusRequest,
)
from app.skill_management import services


router = APIRouter()


@router.get("/skills", response_model=ListResponse[SkillSummary])
async def list_skills(
    _: Annotated[Staff, Depends(get_current_active_superuser)],
    q: Optional[str] = Query(None),
):
    return ListResponse(data=services.list_skills(q))


@router.get("/skills/{skill_id}/tree", response_model=SingleResponse[SkillFileNode])
async def get_skill_tree(
    skill_id: str,
    _: Annotated[Staff, Depends(get_current_active_superuser)],
):
    return SingleResponse(data=services.skill_tree(skill_id))


@router.get("/skills/{skill_id}/file", response_model=SingleResponse[SkillFileContent])
async def get_skill_file(
    skill_id: str,
    path: str = Query(..., description="Path relative to skill root"),
    _: Annotated[Staff, Depends(get_current_active_superuser)] = None,
):
    return SingleResponse(data=services.read_skill_file(skill_id, path))


@router.put("/skills/{skill_id}/file", response_model=SingleResponse[dict])
async def put_skill_file(
    skill_id: str,
    body: SaveSkillFileRequest,
    path: str = Query(..., description="Path relative to skill root"),
    _: Annotated[Staff, Depends(get_current_active_superuser)] = None,
):
    services.write_skill_file(
        skill_id,
        path,
        is_binary=body.is_binary,
        content=body.content,
        content_base64=body.content_base64,
    )
    return SingleResponse(data={"ok": True})


@router.post("/skills/{skill_id}/ops", response_model=SingleResponse[dict])
async def skill_batch_ops(
    skill_id: str,
    body: SkillBatchOpsRequest,
    _: Annotated[Staff, Depends(get_current_active_superuser)],
):
    for op in body.ops:
        if op.op == "delete":
            services.delete_skill_path(skill_id, op.path)
        elif op.op == "rename":
            if not op.new_path:
                raise HTTPException(status_code=400, detail="missing_new_path")
            services.rename_skill_path(skill_id, op.path, op.new_path)
        elif op.op == "mkdir":
            services.mkdir_skill_path(skill_id, op.path)
        elif op.op == "create_file":
            services.write_skill_file(
                skill_id,
                op.path,
                is_binary=op.is_binary,
                content=op.content,
                content_base64=op.content_base64,
            )
        else:
            raise HTTPException(status_code=400, detail="invalid_op")
    return SingleResponse(data={"ok": True})


# --- Meta & Versioning Endpoints ---

@router.get("/skills/{skill_id}/meta", response_model=SingleResponse[SkillMeta])
async def get_skill_meta(
    skill_id: str,
    _: Annotated[Staff, Depends(get_current_active_superuser)],
):
    return SingleResponse(data=services.get_skill_meta(skill_id))


@router.put("/skills/{skill_id}/status", response_model=SingleResponse[SkillMeta])
async def update_skill_status(
    skill_id: str,
    body: UpdateSkillStatusRequest,
    _: Annotated[Staff, Depends(get_current_active_superuser)],
):
    return SingleResponse(data=services.update_skill_status(skill_id, body.status))


@router.get("/skills/{skill_id}/versions", response_model=ListResponse[SkillVersionSummary])
async def list_skill_versions(
    skill_id: str,
    _: Annotated[Staff, Depends(get_current_active_superuser)],
):
    return ListResponse(data=services.list_skill_versions(skill_id))


@router.post("/skills/{skill_id}/versions", response_model=SingleResponse[SkillVersionSummary])
async def create_skill_version(
    skill_id: str,
    body: CreateSkillVersionRequest,
    _: Annotated[Staff, Depends(get_current_active_superuser)],
):
    return SingleResponse(data=services.create_skill_version(skill_id, body.message))


@router.post("/skills/{skill_id}/versions/{version_id}/restore", response_model=SingleResponse[dict])
async def restore_skill_version(
    skill_id: str,
    version_id: str,
    _: Annotated[Staff, Depends(get_current_active_superuser)],
):
    services.restore_skill_version(skill_id, version_id)
    return SingleResponse(data={"ok": True})

