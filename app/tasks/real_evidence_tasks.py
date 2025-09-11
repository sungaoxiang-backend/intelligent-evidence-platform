from app.core.celery_app import celery_app
from loguru import logger
import asyncio
from typing import List, Optional, Dict, Any, Callable
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import async_session_factory
from app.evidences.services import auto_process
from app.evidences.models import Evidence
from app.cases.models import Case
from sqlalchemy import select
from sqlalchemy.orm import joinedload

# 确保所有模型都被正确导入，避免 SQLAlchemy 关系解析问题
from app.users.models import User  # 导入 User 模型
from app.staffs.models import Staff  # 导入 Staff 模型
from app.cases.models import CaseParty  # 导入 CaseParty 模型


@celery_app.task(bind=True)
def analyze_evidences_task(self, case_id: int, evidence_ids: List[int], 
                          auto_classification: bool = True, 
                          auto_feature_extraction: bool = True) -> Dict[str, Any]:
    """
    真实的证据分析任务
    
    Args:
        case_id: 案件ID
        evidence_ids: 证据ID列表
        auto_classification: 是否自动分类
        auto_feature_extraction: 是否自动特征提取
        
    Returns:
        dict: 分析结果
    """
    logger.info(f"开始分析证据任务: case_id={case_id}, evidence_ids={evidence_ids}")
    
    # 创建进度更新函数
    def update_progress(status: str, message: str, progress: Optional[int] = None):
        """更新任务进度"""
        meta = {
            "status": status,
            "message": message
        }
        if progress is not None:
            meta["progress"] = str(progress)
        
        self.update_state(
            state="PROGRESS",
            meta=meta
        )
        logger.info(f"任务进度更新: {status} - {message} ({progress}%)")
    
    try:
        # 更新任务状态为开始
        update_progress("started", "开始证据分析任务", 0)
        
        # 运行异步任务
        result = asyncio.run(_analyze_evidences_async(
            case_id=case_id,
            evidence_ids=evidence_ids,
            auto_classification=auto_classification,
            auto_feature_extraction=auto_feature_extraction,
            update_progress=update_progress
        ))
        
        # 更新任务状态为完成
        update_progress("completed", f"成功分析 {len(result.get('evidences', []))} 个证据", 100)
        
        logger.info(f"证据分析任务完成: {result}")
        return result
        
    except Exception as e:
        logger.error(f"证据分析任务失败: {str(e)}")
        import traceback
        error_traceback = traceback.format_exc()
        logger.error(f"错误详情: {error_traceback}")
        
        # 更新任务状态为失败，确保异常信息可以被正确序列化
        self.update_state(
            state="FAILURE",
            meta={
                "status": "failed",
                "message": f"证据分析失败: {str(e)}",
                "error": str(e),
                "traceback": error_traceback
            }
        )
        
        # 重新抛出异常，但确保异常类型可以被序列化
        raise Exception(f"证据分析失败: {str(e)}")


async def _analyze_evidences_async(
    case_id: int,
    evidence_ids: List[int],
    auto_classification: bool,
    auto_feature_extraction: bool,
    update_progress: Callable
) -> Dict[str, Any]:
    """
    异步执行证据分析
    
    Args:
        case_id: 案件ID
        evidence_ids: 证据ID列表
        auto_classification: 是否自动分类
        auto_feature_extraction: 是否自动特征提取
        update_progress: 进度更新函数
        
    Returns:
        dict: 分析结果
    """
    async with async_session_factory() as db:
        try:
            # 验证案件是否存在 - 使用简单的查询避免关系解析
            update_progress("validating", "验证案件信息", 5)
            case_query = await db.execute(
                select(Case.id, Case.case_type, Case.case_status).where(Case.id == case_id)
            )
            case_result = case_query.first()
            if not case_result:
                raise ValueError(f"案件不存在: ID={case_id}")
            
            # 验证证据是否存在 - 使用简单的查询避免关系解析
            update_progress("validating", "验证证据信息", 10)
            evidence_query = await db.execute(
                select(Evidence.id, Evidence.file_name, Evidence.file_url, Evidence.evidence_status, 
                       Evidence.classification_category, Evidence.evidence_features, Evidence.evidence_role)
                .where(
                    Evidence.id.in_(evidence_ids),
                    Evidence.case_id == case_id
                )
            )
            evidence_results = evidence_query.all()
            if not evidence_results:
                raise ValueError(f"未找到有效的证据: case_id={case_id}, evidence_ids={evidence_ids}")
            
            # 将查询结果转换为 Evidence 对象（简化版本）
            evidences = []
            for row in evidence_results:
                evidence = Evidence()
                evidence.id = row.id
                evidence.file_name = row.file_name
                evidence.file_url = row.file_url
                evidence.evidence_status = row.evidence_status
                evidence.classification_category = row.classification_category
                evidence.evidence_features = row.evidence_features
                evidence.evidence_role = row.evidence_role
                evidence.case_id = case_id
                evidences.append(evidence)
            
            logger.info(f"找到 {len(evidences)} 个证据进行分析")
            
            # 创建进度回调函数
            async def send_progress(data: Dict[str, Any]):
                """发送进度更新"""
                status = data.get("status", "processing")
                message = data.get("message", "处理中...")
                
                # 根据状态映射进度
                progress_map = {
                    "uploaded": 15,
                    "classifying": 20,
                    "classified": 40,
                    "extracting": 50,
                    "ocr_processing": 60,
                    "llm_processing": 70,
                    "features_extracted": 80,
                    "role_annotation": 85,
                    "role_annotated": 90,
                    "completed": 95
                }
                
                progress = progress_map.get(status, 50)
                update_progress(status, message, progress)
            
            # 调用真实的证据分析服务
            update_progress("processing", "开始证据分析处理", 15)
            analyzed_evidences = await auto_process(
                db=db,
                case_id=case_id,
                files=None,  # 明确传递 None，不使用 UploadFile
                evidence_ids=evidence_ids,
                auto_classification=auto_classification,
                auto_feature_extraction=auto_feature_extraction,
                send_progress=send_progress
            )
            
            # 准备返回结果
            result = {
                "case_id": case_id,
                "evidence_ids": evidence_ids,
                "analyzed_count": len(analyzed_evidences),
                "evidences": [
                    {
                        "id": evidence.id,
                        "file_name": evidence.file_name,
                        "classification_category": evidence.classification_category,
                        "classification_confidence": evidence.classification_confidence,
                        "evidence_status": evidence.evidence_status,
                        "evidence_role": evidence.evidence_role,
                        "features_count": len(evidence.evidence_features) if evidence.evidence_features else 0
                    }
                    for evidence in analyzed_evidences
                ],
                "summary": {
                    "total_evidences": len(analyzed_evidences),
                    "classified_count": len([e for e in analyzed_evidences if e.classification_category]),
                    "features_extracted_count": len([e for e in analyzed_evidences if e.evidence_features]),
                    "role_annotated_count": len([e for e in analyzed_evidences if e.evidence_role])
                }
            }
            
            logger.info(f"证据分析完成: {result['summary']}")
            return result
            
        except Exception as e:
            logger.error(f"异步证据分析失败: {str(e)}")
            import traceback
            error_traceback = traceback.format_exc()
            logger.error(f"异步证据分析错误详情: {error_traceback}")
            raise Exception(f"异步证据分析失败: {str(e)}")


@celery_app.task(bind=True)
def batch_analyze_evidences_task(self, case_id: int, evidence_ids: List[int], 
                                auto_classification: bool = True, 
                                auto_feature_extraction: bool = True) -> Dict[str, Any]:
    """
    批量证据分析任务（与前端API兼容）
    
    Args:
        case_id: 案件ID
        evidence_ids: 证据ID列表
        auto_classification: 是否自动分类
        auto_feature_extraction: 是否自动特征提取
        
    Returns:
        dict: 分析结果，包含task_ids
    """
    logger.info(f"开始批量证据分析任务: case_id={case_id}, evidence_ids={evidence_ids}")
    
    try:
        # 为每个证据创建单独的分析任务
        task_ids = []
        
        for evidence_id in evidence_ids:
            # 创建单个证据分析任务
            task = analyze_evidences_task.delay(
                case_id=case_id,
                evidence_ids=[evidence_id],  # 单个证据
                auto_classification=auto_classification,
                auto_feature_extraction=auto_feature_extraction
            )
            task_ids.append(task.id)
            logger.info(f"创建证据分析任务: evidence_id={evidence_id}, task_id={task.id}")
        
        result = {
            "case_id": case_id,
            "evidence_ids": evidence_ids,
            "task_ids": task_ids,
            "message": f"已创建 {len(task_ids)} 个证据分析任务",
            "auto_classification": auto_classification,
            "auto_feature_extraction": auto_feature_extraction
        }
        
        logger.info(f"批量证据分析任务创建完成: {result}")
        return result
        
    except Exception as e:
        logger.error(f"批量证据分析任务创建失败: {str(e)}")
        import traceback
        error_traceback = traceback.format_exc()
        logger.error(f"错误详情: {error_traceback}")
        
        # 更新任务状态为失败，确保异常信息可以被正确序列化
        self.update_state(
            state="FAILURE",
            meta={
                "status": "failed",
                "message": f"批量证据分析任务创建失败: {str(e)}",
                "error": str(e),
                "traceback": error_traceback
            }
        )
        
        # 重新抛出异常，但确保异常类型可以被序列化
        raise Exception(f"批量证据分析任务创建失败: {str(e)}")
