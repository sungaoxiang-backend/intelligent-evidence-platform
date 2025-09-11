# 任务模块初始化文件

from fastapi import APIRouter, HTTPException
from app.core.celery_app import celery_app

# 创建任务路由
router = APIRouter(prefix="/tasks", tags=["tasks"])

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