# 简化版证据链 API

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import DBSession, get_current_staff
from app.staffs.models import Staff
from app.evidence_chains.services import EvidenceChainService
from app.evidence_chains.schemas import EvidenceChainDashboard

router = APIRouter()


@router.get("/{case_id}/dashboard", response_model=EvidenceChainDashboard)
async def get_evidence_chain_dashboard(
    case_id: int,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)]
):
    """
    获取案件证据链看板
    
    这是核心接口，实时查询证据状态并与配置对比
    """
    service = EvidenceChainService(db)
    
    try:
        dashboard = await service.get_case_evidence_dashboard(case_id)
        return dashboard
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取证据链看板失败: {str(e)}")


@router.get("/templates")
async def get_evidence_chain_templates(
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)]
):
    """
    获取所有证据链模板配置
    """
    service = EvidenceChainService(db)
    
    try:
        from app.core.config_manager import config_manager
        chains = config_manager.get_all_evidence_chains()
        
        return {
            "total_templates": len(chains),
            "templates": [
                {
                    "chain_id": chain.get("chain_id"),
                    "required_evidence_count": len(chain.get("required_evidence_types", [])),
                    "evidence_types": [
                        {
                            "evidence_type": et.get("evidence_type"),
                            "required_slots": et.get("core_evidence_slot", [])
                        }
                        for et in chain.get("required_evidence_types", [])
                    ]
                }
                for chain in chains
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取模板失败: {str(e)}")