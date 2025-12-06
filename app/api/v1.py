from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.cases.routers import router as cases_router
from app.cases.services import get_multi_with_count
from app.core.routers import router as config_router
from app.db.session import get_db
from app.documents.routers import router as documents_router
from app.documents_template.routers import router as documents_template_router
from app.template_editor.routers import router as template_editor_router
from app.document_generation.routers import router as document_generation_router
from app.documents_management.routers import router as documents_management_router
from app.evidence_chains.routers import router as chain_router
from app.evidences.routers import router as evidences_router
from app.agentic.routers import router as agentic_router
from app.ocr import router as ocr_router
from app.staffs.routers import login_router, router as staffs_router
from app.tasks import router as tasks_router
from app.users.routers import router as users_router
from app.users.services import get_by_wechat_number
from app.wecom.services import wecom_service

api_router = APIRouter()

api_router.include_router(login_router, prefix="/login", tags=["login"])
api_router.include_router(staffs_router, prefix="/staffs", tags=["staffs"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
api_router.include_router(cases_router, prefix="/cases", tags=["cases"])
api_router.include_router(evidences_router, prefix="/evidences", tags=["evidences"])
api_router.include_router(agentic_router, prefix="/agentic", tags=["agentic"])
api_router.include_router(chain_router, prefix="/chain", tags=["chain"])
api_router.include_router(documents_router, prefix="/documents", tags=["documents"])
api_router.include_router(documents_template_router, prefix="/document-templates", tags=["document-templates"])
api_router.include_router(template_editor_router, prefix="/template-editor", tags=["template-editor"])
api_router.include_router(document_generation_router, prefix="/document-generation", tags=["document-generation"])
api_router.include_router(documents_management_router, prefix="/documents", tags=["documents-management"])
api_router.include_router(ocr_router, prefix="/ocr", tags=["ocr"])
api_router.include_router(tasks_router)
api_router.include_router(config_router, tags=["config"])


@api_router.get("/wecom/external-contact/{external_userid}")
async def get_external_contact_detail_v1(
    external_userid: str, 
    db: AsyncSession = Depends(get_db)
):
    """根据 external_userid 获取客户详情（转发企微服务端 API）"""
    try:
        # 1. 获取企业微信客户详情
        wecom_result = await wecom_service.get_external_contact(external_userid)
        
        # 2. 根据external_userid查找对应的用户
        user = await get_by_wechat_number(db, external_userid)
        
        user_info = None
        if user:
            # 3. 获取该用户的案件列表
            cases, total = await get_multi_with_count(
                db, 
                user_id=user.id, 
                skip=0, 
                limit=100  # 限制返回100个案件
            )
            
            # 4. 构建案件列表数据
            case_list = []
            for case in cases:
                # 构建当事人列表
                parties_list = []
                for party in case.case_parties:
                    party_data = {
                        "id": party.id,
                        "party_name": party.party_name,
                        "party_role": party.party_role,
                        "party_type": party.party_type,
                        "name": party.name,
                        "gender": party.gender,
                        "birthday": party.birthday,
                        "nation": party.nation,
                        "address": party.address,
                        "id_card": party.id_card,
                        "phone": party.phone,
                        "company_name": party.company_name,
                        "company_address": party.company_address,
                        "company_code": party.company_code,
                        "owner_name": party.owner_name,
                        "bank_address": party.bank_address,
                        "bank_account": party.bank_account,
                        "bank_phone": party.bank_phone
                    }
                    parties_list.append(party_data)
                
                case_data = {
                    "id": case.id,
                    "case_type": case.case_type.value if case.case_type else None,
                    "case_status": case.case_status.value if case.case_status else None,
                    "loan_amount": case.loan_amount,
                    "loan_date": case.loan_date.isoformat() if case.loan_date else None,
                    "court_name": case.court_name,
                    "description": case.description,
                    "parties": parties_list,
                    "created_at": (
                        case.created_at.isoformat() if case.created_at else None
                    ),
                    "updated_at": (
                        case.updated_at.isoformat() if case.updated_at else None
                    )
                }
                case_list.append(case_data)
            
            # 5. 构建用户信息
            user_info = {
                "user_id": user.id,
                "name": user.name,
                "wechat_nickname": user.wechat_nickname,
                "wechat_number": user.wechat_number,
                "wechat_avatar": user.wechat_avatar,
                "id_card": user.id_card,
                "phone": user.phone,
                "case_list": case_list,
                "case_count": total
            }
        
        # 6. 构建最终返回结果
        result = {
            "success": True,
            "data": {
                **wecom_result,  # 包含原有的企业微信数据
                "user_info": user_info  # 新增的用户信息
            }
        }
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail="external_contact_fetch_failed"
        ) from e