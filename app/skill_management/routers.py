from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from loguru import logger

from app.core.deps import get_current_active_superuser
from app.core.config import settings
from app.core.response import ListResponse, SingleResponse
from app.staffs.models import Staff
from app.skill_management.schemas import (
    AgentPromptVersionDetail,
    AgentPromptVersionSummary,
    AgentSummary,
    CreatePromptVersionRequest,
    PlaygroundRunRequest,
    PlaygroundRunResponse,
    SaveSkillFileRequest,
    SkillBatchOpsRequest,
    SkillFileContent,
    SkillFileNode,
    SkillSummary,
    UpdatePromptVersionRequest,
)
from app.skill_management import services
from app.skill_management.agent import SkillManagementClaudeAgent


router = APIRouter()
agent = SkillManagementClaudeAgent()


@router.get("/skills", response_model=ListResponse[SkillSummary])
async def list_skills(
    _: Annotated[Staff, Depends(get_current_active_superuser)],
    q: Optional[str] = Query(None),
):
    return ListResponse(data=services.list_skills(q))


@router.get("/skills/{skill_id}", response_model=SingleResponse[SkillSummary])
async def get_skill(
    skill_id: str,
    _: Annotated[Staff, Depends(get_current_active_superuser)],
):
    skills = services.list_skills()
    for s in skills:
        if s.id == skill_id:
            return SingleResponse(data=s)
    raise HTTPException(status_code=404, detail="skill_not_found")


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


@router.get("/agents", response_model=ListResponse[AgentSummary])
async def list_agents(
    _: Annotated[Staff, Depends(get_current_active_superuser)],
):
    return ListResponse(data=[AgentSummary(id=a) for a in services.list_agents()])


@router.get("/agents/{agent_id}/prompts", response_model=ListResponse[AgentPromptVersionSummary])
async def list_agent_prompts(
    agent_id: str,
    _: Annotated[Staff, Depends(get_current_active_superuser)],
):
    return ListResponse(data=services.list_prompt_versions(agent_id))


@router.get("/agents/{agent_id}/prompts/{version}", response_model=SingleResponse[AgentPromptVersionDetail])
async def get_agent_prompt_version(
    agent_id: str,
    version: str,
    _: Annotated[Staff, Depends(get_current_active_superuser)],
):
    return SingleResponse(data=services.get_prompt_version(agent_id, version))


@router.post("/agents/{agent_id}/prompts", response_model=SingleResponse[AgentPromptVersionDetail])
async def create_agent_prompt_version(
    agent_id: str,
    body: CreatePromptVersionRequest,
    _: Annotated[Staff, Depends(get_current_active_superuser)],
):
    return SingleResponse(
        data=services.create_prompt_version_with_skills(
            agent_id,
            body.version,
            lang=body.lang,
            content=body.content,
            active_skill_ids=body.active_skill_ids,
        )
    )


@router.put("/agents/{agent_id}/prompts/{version}", response_model=SingleResponse[AgentPromptVersionDetail])
async def update_agent_prompt_version(
    agent_id: str,
    version: str,
    body: UpdatePromptVersionRequest,
    _: Annotated[Staff, Depends(get_current_active_superuser)],
):
    return SingleResponse(
        data=services.update_prompt_version_with_skills(
            agent_id,
            version,
            lang=body.lang,
            content=body.content,
            active_skill_ids=body.active_skill_ids,
        )
    )


@router.delete("/agents/{agent_id}/prompts/{version}", response_model=SingleResponse[dict])
async def delete_agent_prompt_version(
    agent_id: str,
    version: str,
    _: Annotated[Staff, Depends(get_current_active_superuser)],
):
    services.delete_prompt_version(agent_id, version)
    return SingleResponse(data={"ok": True})


@router.post("/playground/run", response_model=SingleResponse[PlaygroundRunResponse])
async def playground_run(
    body: PlaygroundRunRequest,
    _: Annotated[Staff, Depends(get_current_active_superuser)],
):
    prompt_detail = services.get_prompt_version(body.agent_id, body.prompt_version)
    active_skill_ids = prompt_detail.active_skill_ids
    system_prompt = services.build_system_prompt_with_skills(prompt_detail.content, active_skill_ids)

    if not settings.ANTHROPIC_AUTH_TOKEN:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "anthropic_auth_not_configured",
                "message": "缺少 ANTHROPIC_AUTH_TOKEN（请在后端 .env 配置）",
            },
        )

    try:
        result = await agent.run(
            user_message=body.message,
            system_prompt=system_prompt,
            model=body.model,
            max_turns=body.max_turns,
        )
    except Exception as e:
        logger.exception("Skill management playground run failed")
        raise HTTPException(
            status_code=500,
            detail={"error": "playground_run_failed", "message": str(e)[:400]},
        ) from e

    return SingleResponse(
        data=PlaygroundRunResponse(
            output=result.output,
            session_id=result.session_id,
            total_cost_usd=result.total_cost_usd,
            raw=result.raw,
        )
    )
