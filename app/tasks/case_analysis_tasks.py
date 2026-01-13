"""
案件分析 Celery 任务

提供后台异步执行案件分析的能力。
"""

import asyncio
from datetime import datetime
from typing import List, Optional
from loguru import logger

from app.core.celery_app import celery_app


@celery_app.task(bind=True, name='app.tasks.case_analysis_tasks.run_case_analysis_task')
def run_case_analysis_task(
    self,
    case_id: int,
    report_id: int,
    trigger_type: str = "manual",
    ref_commit_ids: List[int] = None
):
    """
    Celery 任务：执行案件分析
    
    Args:
        case_id: 案件ID
        report_id: 预创建的报告ID（用于更新状态）
        trigger_type: 触发类型
        ref_commit_ids: 引用的 commit IDs
        
    Returns:
        分析结果
    """
    logger.info(f"[任务启动] 案件分析任务开始 - 案件ID: {case_id}, 报告ID: {report_id}")
    
    # 使用 asyncio 运行异步函数
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        result = loop.run_until_complete(
            _execute_analysis(
                task=self,
                case_id=case_id,
                report_id=report_id,
                trigger_type=trigger_type,
                ref_commit_ids=ref_commit_ids or []
            )
        )
        return result
    except Exception as e:
        logger.error(f"[任务失败] 案件分析任务失败 - 案件ID: {case_id}, 错误: {e}")
        # 更新报告状态为失败
        loop.run_until_complete(_update_report_status(report_id, "failed", str(e)))
        raise
    finally:
        loop.close()


async def _execute_analysis(
    task,
    case_id: int,
    report_id: int,
    trigger_type: str,
    ref_commit_ids: List[int]
) -> dict:
    """
    执行分析的异步核心逻辑
    """
    from app.db.session import async_session_factory
    from app.cases.services import get_by_id as get_case_by_id, get_commits_by_case_id
    from app.cases.models import CaseAnalysisReport, AnalysisReportStatus
    from app.agentic.agents.case_analysis_agent import run_case_analysis
    from sqlalchemy import select
    
    async with async_session_factory() as db:
        # 1. 更新报告状态为处理中
        report = await db.get(CaseAnalysisReport, report_id)
        if report:
            report.status = AnalysisReportStatus.PROCESSING
            await db.commit()
        
        # 更新 Celery 任务状态
        task.update_state(state='PROCESSING', meta={
            'case_id': case_id,
            'report_id': report_id,
            'progress': 10,
            'message': '正在获取案件信息...'
        })
        
        # 2. 获取案件信息
        case = await get_case_by_id(db, case_id)
        if not case:
            raise ValueError(f"案件不存在: {case_id}")
        
        # 序列化案件信息
        case_info = {
            "id": case.id,
            "case_type": case.case_type.value if case.case_type else None,
            "case_status": case.case_status.value if case.case_status else None,
            "loan_amount": float(case.loan_amount) if case.loan_amount else 0,
            "loan_date": case.loan_date.isoformat() if case.loan_date else None,
            "court_name": case.court_name,
            "description": case.description,
            "parties": [
                {
                    "party_name": p.party_name,
                    "party_role": p.party_role,
                    "party_type": p.party_type,
                    "name": p.name,
                    "phone": p.phone,
                    "address": p.address,
                    "id_card": p.id_card,
                    "company_name": p.company_name,
                    "company_address": p.company_address,
                    "company_code": p.company_code
                } for p in case.case_parties
            ]
        }
        
        task.update_state(state='PROCESSING', meta={
            'case_id': case_id,
            'report_id': report_id,
            'progress': 20,
            'message': '正在获取提交记录...'
        })
        
        # 3. 获取所有提交记录（全量）
        commits = await get_commits_by_case_id(db, case_id)
        
        # 序列化提交记录
        commits_data = [
            {
                "id": c.id,
                "statement": c.statement,
                "materials": c.materials,
                "created_at": c.created_at.isoformat() if c.created_at else None
            } for c in commits
        ]
        
        logger.info(f"[分析准备] 案件 #{case_id}: 获取到 {len(commits_data)} 条提交记录")
        
        # 4. 定义进度回调
        async def progress_callback(data: dict):
            progress = data.get('progress', 0)
            message = data.get('message', '')
            # 映射进度到 20-90 范围
            mapped_progress = 20 + int(progress * 0.7)
            
            task.update_state(state='PROCESSING', meta={
                'case_id': case_id,
                'report_id': report_id,
                'progress': mapped_progress,
                'message': message
            })

            # HACK: 将实时进度写入 error_message 字段，供前端轮询显示日志
            try:
                rp = await db.get(CaseAnalysisReport, report_id)
                if rp:
                    rp.error_message = message
                    await db.commit()
            except Exception as e:
                logger.warning(f"Failed to update report progress in DB: {e}")
        
        # 5. 执行分析
        task.update_state(state='PROCESSING', meta={
            'case_id': case_id,
            'report_id': report_id,
            'progress': 30,
            'message': '正在调用 AI 进行案件分析...'
        })
        
        report_content = await run_case_analysis(
            case_id=case_id,
            case_info=case_info,
            commits=commits_data,
            progress_callback=progress_callback
        )
        
        # 6. 更新报告内容
        task.update_state(state='PROCESSING', meta={
            'case_id': case_id,
            'report_id': report_id,
            'progress': 95,
            'message': '正在保存分析报告...'
        })
        
        # 重新获取报告并更新
        report = await db.get(CaseAnalysisReport, report_id)
        if report:
            report.content = report_content
            report.status = AnalysisReportStatus.COMPLETED
            report.completed_at = datetime.now()
            report.ref_commit_ids = [c.id for c in commits]  # 记录参与分析的所有 commits
            await db.commit()
        
        logger.info(f"[分析完成] 案件 #{case_id} 分析完成，报告ID: {report_id}")
        
        return {
            "success": True,
            "report_id": report_id,
            "case_id": case_id,
            "message": "分析完成"
        }


async def _update_report_status(report_id: int, status: str, error_message: str = None):
    """更新报告状态"""
    from app.db.session import async_session_factory
    from app.cases.models import CaseAnalysisReport
    
    async with async_session_factory() as db:
        report = await db.get(CaseAnalysisReport, report_id)
        if report:
            report.status = status
            if error_message:
                report.error_message = error_message
            if status == "completed":
                report.completed_at = datetime.now()
            await db.commit()
