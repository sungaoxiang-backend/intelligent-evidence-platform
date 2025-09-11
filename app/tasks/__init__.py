# 任务模块初始化文件

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from app.core.celery_app import celery_app

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
        # 为每个证据创建一个分析任务
        task_ids = []
        for evidence_id in request.evidence_ids:
            task = analyze_evidence_task.delay(evidence_id, "smart")
            task_ids.append(task.id)
        
        return {
            "task_ids": task_ids, 
            "status": "started", 
            "message": f"已启动 {len(task_ids)} 个证据分析任务"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status/{task_id}")
async def get_task_status(task_id: str):
    """获取任务状态"""
    try:
        task = celery_app.AsyncResult(task_id)
        return {
            "task_id": task_id,
            "status": task.status,
            "result": task.result if task.ready() else None,
            "info": task.info if not task.ready() else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))