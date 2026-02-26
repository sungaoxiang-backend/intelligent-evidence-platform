# 任务模块初始化文件

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from app.core.celery_app import celery_app
from loguru import logger

# 创建任务路由
router = APIRouter(prefix="/tasks", tags=["tasks"])

# 请求模型
class AnalyzeEvidenceRequest(BaseModel):
    evidence_id: str
    evidence_type: str = "basic"

class BatchAnalyzeEvidencesRequest(BaseModel):
    case_id: str
    evidence_ids: List[str]

class GenerateEvidenceChainRequest(BaseModel):
    case_id: str
    evidence_ids: List[str]

# 导入任务函数
from .example_tasks import example_task, add_numbers, process_document
from .document_tasks import process_document_task, analyze_document_task
from .evidence_tasks import analyze_evidence_task, generate_evidence_chain_task
from .real_evidence_tasks import analyze_evidences_task, batch_analyze_evidences_task, analyze_association_evidences_task
from .case_analysis_tasks import run_case_analysis_task

# 注册任务路由端点
@router.post("/example")
async def run_example_task(name: str, seconds: int = 5):
    """运行示例任务"""
    try:
        task = example_task.delay(name, seconds)
        return {"task_id": task.id, "status": "started"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/add")
async def run_add_task(a: int, b: int):
    """运行加法任务"""
    try:
        task = add_numbers.delay(a, b)
        return {"task_id": task.id, "status": "started"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/process-document")
async def run_process_document(doc_id: str):
    """运行文档处理任务"""
    try:
        task = process_document.delay(doc_id)
        return {"task_id": task.id, "status": "started"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze-evidence")
async def run_analyze_evidence(request: AnalyzeEvidenceRequest):
    """运行证据分析任务"""
    try:
        task = analyze_evidence_task.delay(request.evidence_id, request.evidence_type)
        return {"task_id": task.id, "status": "started"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-evidence-chain")
async def run_generate_evidence_chain(request: GenerateEvidenceChainRequest):
    """生成证据链任务"""
    try:
        task = generate_evidence_chain_task.delay(request.case_id, request.evidence_ids)
        return {"task_id": task.id, "status": "started"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/batch-analyze-evidences")
async def run_batch_analyze_evidences(request: BatchAnalyzeEvidencesRequest):
    """批量分析证据任务 - 用于智能证据分析"""
    try:
        # 使用真实的证据分析任务 - 使用完整路径名称
        task = celery_app.send_task(
            'app.tasks.real_evidence_tasks.batch_analyze_evidences_task',
            args=[],
            kwargs={
                'case_id': int(request.case_id),
                'evidence_ids': [int(eid) for eid in request.evidence_ids],
                'auto_classification': True,
                'auto_feature_extraction': True
            }
        )
        
        return {
            "task_ids": [task.id], 
            "status": "started", 
            "message": f"已启动批量证据分析任务，包含 {len(request.evidence_ids)} 个证据"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/real-analyze-evidences")
async def run_real_analyze_evidences(request: BatchAnalyzeEvidencesRequest):
    """真实的证据分析任务 - 直接调用auto_process服务"""
    try:
        # 使用真实的证据分析任务 - 使用完整路径名称
        task = celery_app.send_task(
            'app.tasks.real_evidence_tasks.analyze_evidences_task',
            args=[],
            kwargs={
                'case_id': int(request.case_id),
                'evidence_ids': [int(eid) for eid in request.evidence_ids],
                'auto_classification': True,
                'auto_feature_extraction': True
            }
        )
        
        return {
            "task_ids": [task.id], 
            "status": "started", 
            "message": f"已启动真实证据分析任务，包含 {len(request.evidence_ids)} 个证据"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze-association-evidences")
async def run_analyze_association_evidences(request: BatchAnalyzeEvidencesRequest):
    """关联证据分析任务 - 专门处理微信聊天记录的关联特征提取"""
    try:
        # 使用关联证据分析任务
        task = celery_app.send_task(
            'app.tasks.real_evidence_tasks.analyze_association_evidences_task',
            args=[],
            kwargs={
                'case_id': int(request.case_id),
                'evidence_ids': [int(eid) for eid in request.evidence_ids]
            }
        )
        
        return {
            "task_ids": [task.id], 
            "status": "started", 
            "message": f"已启动关联证据分析任务，包含 {len(request.evidence_ids)} 个微信聊天记录证据"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status/{task_id}")
async def get_task_status(task_id: str):
    """获取任务状态"""
    try:
        task = celery_app.AsyncResult(task_id)

        # 安全地获取任务结果
        result = None
        info = None
        status = "PENDING"

        try:
            # 先获取状态，避免直接调用 ready() 触发异常
            status = task.state
        except Exception as e:
            logger.warning(f"获取任务状态失败: {str(e)}")

        try:
            if status in ('SUCCESS', 'FAILURE', 'REVOKED'):
                # 只有在任务完成时才尝试获取结果
                result = task.result
        except KeyError as e:
            # 处理缺少 exc_type 的异常
            logger.warning(f"任务结果格式异常: {str(e)}")
            result = {
                "error": "任务结果格式异常，可能存在数据损坏",
                "original_status": status
            }
        except Exception as e:
            result = {
                "error": "任务结果无法序列化",
                "error_message": str(e)
            }

        if status == 'PENDING':
            try:
                info = task.info
            except Exception as e:
                info = {
                    "error": "任务信息无法序列化",
                    "error_message": str(e)
                }

        return {
            "task_id": task_id,
            "status": status,
            "result": result,
            "info": info
        }
    except Exception as e:
        # 记录详细错误信息
        import traceback
        error_traceback = traceback.format_exc()
        logger.error(f"获取任务状态失败: {str(e)}")
        logger.error(f"错误详情: {error_traceback}")

        raise HTTPException(
            status_code=500,
            detail=f"获取任务状态失败: {str(e)}"
        )