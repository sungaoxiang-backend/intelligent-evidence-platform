from app.core.celery_app import celery_app
from loguru import logger
import asyncio
from typing import List, Optional, Dict, Any, Callable
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import async_session_factory
from app.evidences.services import auto_process
from app.evidences.models import Evidence
from app.cases.models import Case
from app.cases.services import auto_process as cases_auto_process
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
        logger.info(f"🚀 任务进度更新: {status} - {message} ({progress}%)")
        print(f"🚀 任务进度更新: {status} - {message} ({progress}%)")  # 确保在控制台看到
    
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
                progress = data.get("progress")
                current = data.get("current")
                total = data.get("total")
                
                # 优先使用直接传递的progress值
                if progress is not None:
                    final_progress = min(100, max(0, int(progress)))
                    logger.info(f"📊 直接进度: {progress}%")
                elif current is not None and total is not None and total > 0:
                    final_progress = min(100, max(0, int((current / total) * 100)))
                    logger.info(f"📊 计算进度: {current}/{total} = {final_progress}%")
                else:
                    # 如果没有进度数据，不更新进度，只更新状态和消息
                    logger.warning(f"⚠️ 缺少进度数据: status={status}, progress={progress}, current={current}, total={total}")
                    # 不调用update_progress，避免进度跳跃
                    return
                
                # 传递原始状态和真实进度
                update_progress(status, message, final_progress)
            
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


@celery_app.task(bind=True)
def analyze_association_evidences_task(self, case_id: int, evidence_ids: List[int]) -> Dict[str, Any]:
    """
    关联证据分析任务 - 专门处理微信聊天记录的关联特征提取
    
    Args:
        case_id: 案件ID
        evidence_ids: 证据ID列表（必须是已分类为"微信聊天记录"的证据）
        
    Returns:
        dict: 分析结果
    """
    logger.info(f"开始关联证据分析任务: case_id={case_id}, evidence_ids={evidence_ids}")
    
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
        update_progress("started", "开始关联证据分析", 0)
        
        # 运行异步任务
        result = asyncio.run(run_association_analysis_async(case_id, evidence_ids, update_progress))
        
        if result is None:
            update_progress("failed", "关联证据分析失败，未获取到有效结果", 0)
            return {
                "success": False,
                "message": "关联证据分析失败，未获取到有效结果",
                "case_id": case_id,
                "evidence_ids": evidence_ids
            }
        
        # 更新任务状态为成功
        update_progress("completed", f"关联证据分析完成，共处理 {len(result)} 个特征组", 100)
        
        return {
            "success": True,
            "message": f"关联证据分析完成，共处理 {len(result)} 个特征组",
            "case_id": case_id,
            "evidence_ids": evidence_ids,
            "association_features_count": len(result)
        }
        
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        logger.error(f"关联证据分析任务失败: {str(e)}")
        logger.error(f"错误堆栈: {error_traceback}")
        
        # 更新任务状态为失败
        self.update_state(
            state="FAILURE",
            meta={
                "status": "failed",
                "message": f"关联证据分析任务失败: {str(e)}",
                "error": str(e),
                "traceback": error_traceback
            }
        )
        
        # 重新抛出异常
        raise Exception(f"关联证据分析任务失败: {str(e)}")


async def run_association_analysis_async(case_id: int, evidence_ids: List[int], update_progress: Callable) -> Optional[List]:
    """
    运行关联证据分析的异步函数
    
    Args:
        case_id: 案件ID
        evidence_ids: 证据ID列表
        update_progress: 进度更新函数
        
    Returns:
        List: 关联特征列表
    """
    async with async_session_factory() as db:
        try:
            # 创建进度发送函数
            async def send_progress(progress_data: Dict[str, Any]):
                """发送进度数据"""
                status = progress_data.get("status", "processing")
                message = progress_data.get("message", "处理中...")
                progress = progress_data.get("progress", 0)
                update_progress(status, message, progress)
            
            # 调用 cases 模块的 auto_process 函数
            result = await cases_auto_process(
                db=db,
                case_id=case_id,
                evidence_ids=evidence_ids,
                send_progress=send_progress
            )
            
            return result
            
        except Exception as e:
            logger.error(f"关联证据分析异步执行失败: {str(e)}")
            raise e


@celery_app.task(bind=True, name="app.tasks.real_evidence_tasks.cast_evidence_cards_task")
def cast_evidence_cards_task(self, case_id: int, evidence_ids: List[int]) -> Dict[str, Any]:
    """
    证据卡片铸造任务 - 从证据特征中铸造证据卡片
    
    Args:
        case_id: 案件ID
        evidence_ids: 证据ID列表
        
    Returns:
        dict: 铸造结果，包含创建的卡片信息
    """
    logger.info(f"开始证据卡片铸造任务: case_id={case_id}, evidence_ids={evidence_ids}")
    
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
        logger.info(f"🚀 卡片铸造任务进度更新: {status} - {message} ({progress}%)")
        print(f"🚀 卡片铸造任务进度更新: {status} - {message} ({progress}%)")  # 确保在控制台看到
    
    try:
        # 更新任务状态为开始
        update_progress("started", "开始证据卡片铸造任务", 0)
        
        # 运行异步任务
        result = asyncio.run(_cast_evidence_cards_async(
            case_id=case_id,
            evidence_ids=evidence_ids,
            update_progress=update_progress
        ))
        
        # 更新任务状态为完成
        update_progress("completed", f"成功铸造 {len(result.get('cards', []))} 个证据卡片", 100)
        
        logger.info(f"证据卡片铸造任务完成: {result}")
        return result
        
    except Exception as e:
        logger.error(f"证据卡片铸造任务失败: {str(e)}")
        import traceback
        error_traceback = traceback.format_exc()
        logger.error(f"错误详情: {error_traceback}")
        
        # 更新任务状态为失败，确保异常信息可以被正确序列化
        self.update_state(
            state="FAILURE",
            meta={
                "status": "failed",
                "message": f"证据卡片铸造失败: {str(e)}",
                "error": str(e),
                "traceback": error_traceback
            }
        )
        
        # 重新抛出异常，但确保异常类型可以被序列化
        raise Exception(f"证据卡片铸造失败: {str(e)}")


async def _cast_evidence_cards_async(
    case_id: int,
    evidence_ids: List[int],
    update_progress: Callable
) -> Dict[str, Any]:
    """
    异步执行证据卡片铸造
    
    Args:
        case_id: 案件ID
        evidence_ids: 证据ID列表
        update_progress: 进度更新函数
        
    Returns:
        dict: 铸造结果
    """
    async with async_session_factory() as db:
        try:
            from app.evidences.services import evidence_card_casting
            from sqlalchemy import select
            
            # 验证案件是否存在
            update_progress("validating", "验证案件信息", 5)
            case_query = await db.execute(
                select(Case.id).where(Case.id == case_id)
            )
            case_result = case_query.first()
            if not case_result:
                raise ValueError(f"案件不存在: ID={case_id}")
            
            # 验证证据是否存在
            update_progress("validating", "验证证据信息", 10)
            evidence_query = await db.execute(
                select(Evidence.id, Evidence.file_name, Evidence.file_url, Evidence.file_extension)
                .where(
                    Evidence.id.in_(evidence_ids),
                    Evidence.case_id == case_id
                )
            )
            evidence_results = evidence_query.all()
            if not evidence_results:
                raise ValueError(f"未找到有效的证据: case_id={case_id}, evidence_ids={evidence_ids}")
            
            logger.info(f"找到 {len(evidence_results)} 个证据进行卡片铸造")
            
            # 开始卡片铸造
            update_progress("processing", "开始证据卡片铸造", 15)
            
            # 调用卡片铸造服务
            # 注意：evidence_card_casting 目前不支持进度回调，如果需要可以在服务层添加
            cards_data = await evidence_card_casting(
                db=db,
                case_id=case_id,
                evidence_ids=evidence_ids
            )
            
            # 更新进度
            update_progress("completed", f"成功铸造 {len(cards_data)} 个证据卡片", 95)
            
            # 准备返回结果
            result = {
                "case_id": case_id,
                "evidence_ids": evidence_ids,
                "cards_count": len(cards_data),
                "cards": [
                    {
                        "id": card["id"],
                        "evidence_ids": card["evidence_ids"],
                        "card_type": card["card_info"].get("card_type") if card.get("card_info") else None,
                        "card_is_associated": card["card_info"].get("card_is_associated") if card.get("card_info") else False,
                        "features_count": len(card["card_info"].get("card_features", [])) if card.get("card_info") else 0,
                        "updated_times": card["updated_times"],
                        "created_at": card["created_at"],
                        "updated_at": card["updated_at"],
                    }
                    for card in cards_data
                ],
                "summary": {
                    "total_cards": len(cards_data),
                    "associated_cards": len([c for c in cards_data if c.get("card_info", {}).get("card_is_associated")]),
                    "single_cards": len([c for c in cards_data if not c.get("card_info", {}).get("card_is_associated")]),
                }
            }
            
            logger.info(f"证据卡片铸造完成: {result['summary']}")
            return result
            
        except Exception as e:
            logger.error(f"异步证据卡片铸造失败: {str(e)}")
            import traceback
            error_traceback = traceback.format_exc()
            logger.error(f"异步证据卡片铸造错误详情: {error_traceback}")
            raise Exception(f"异步证据卡片铸造失败: {str(e)}")
