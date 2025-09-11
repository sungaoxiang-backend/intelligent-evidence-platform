from app.core.celery_app import celery_app
from loguru import logger
import time
import random

@celery_app.task(bind=True)
def analyze_evidence_task(self, evidence_id: str, evidence_type: str) -> dict:
    """
    分析证据任务
    
    Args:
        evidence_id: 证据ID
        evidence_type: 证据类型
        
    Returns:
        dict: 分析结果
    """
    logger.info(f"开始分析证据: {evidence_id} (类型: {evidence_type})")
    
    # 模拟证据分析过程
    total_steps = 12
    for i in range(total_steps):
        time.sleep(1)  # 模拟分析时间
        progress = (i + 1) / total_steps * 100
        # 更新任务进度
        self.update_state(
            state="PROGRESS",
            meta={
                "current": i + 1, 
                "total": total_steps, 
                "status": f"正在分析{evidence_type}证据... {progress:.1f}%"
            }
        )
    
    # 模拟分析结果
    risk_levels = ["低", "中", "高"]
    validity_scores = [random.randint(70, 100), random.randint(40, 80), random.randint(20, 60)]
    
    result = {
        "evidence_id": evidence_id,
        "evidence_type": evidence_type,
        "status": "completed",
        "risk_level": random.choice(risk_levels),
        "validity_score": random.choice(validity_scores),
        "key_findings": [
            f"发现{evidence_type}证据的关键特征",
            f"证据链完整性评估: {random.choice(['完整', '部分缺失', '需要补充'])}",
            f"与其他证据的关联性: {random.choice(['强', '中等', '弱'])}"
        ],
        "recommendations": [
            "建议补充相关证明材料",
            "建议进一步核实证据来源",
            "建议与案件其他证据进行交叉验证"
        ],
        "analysis_time": f"{total_steps} seconds"
    }
    
    logger.info(f"证据分析完成: {result}")
    return result

@celery_app.task(bind=True)
def generate_evidence_chain_task(self, case_id: str, evidence_ids: list) -> dict:
    """
    生成证据链任务
    
    Args:
        case_id: 案件ID
        evidence_ids: 证据ID列表
        
    Returns:
        dict: 证据链生成结果
    """
    logger.info(f"开始生成案件 {case_id} 的证据链，包含 {len(evidence_ids)} 个证据")
    
    # 模拟证据链生成过程
    total_steps = len(evidence_ids) + 3
    current_step = 0
    
    # 步骤1: 分析每个证据
    for evidence_id in evidence_ids:
        current_step += 1
        time.sleep(1)  # 模拟分析时间
        progress = current_step / total_steps * 100
        self.update_state(
            state="PROGRESS",
            meta={
                "current": current_step, 
                "total": total_steps, 
                "status": f"正在分析证据 {evidence_id}... {progress:.1f}%"
            }
        )
    
    # 步骤2: 构建证据链关系
    current_step += 1
    time.sleep(1)
    progress = current_step / total_steps * 100
    self.update_state(
        state="PROGRESS",
        meta={
            "current": current_step, 
            "total": total_steps, 
            "status": f"正在构建证据链关系... {progress:.1f}%"
        }
    )
    
    # 步骤3: 验证证据链完整性
    current_step += 1
    time.sleep(1)
    progress = current_step / total_steps * 100
    self.update_state(
        state="PROGRESS",
        meta={
            "current": current_step, 
            "total": total_steps, 
            "status": f"正在验证证据链完整性... {progress:.1f}%"
        }
    )
    
    # 步骤4: 生成最终报告
    current_step += 1
    time.sleep(1)
    progress = current_step / total_steps * 100
    self.update_state(
        state="PROGRESS",
        meta={
            "current": current_step, 
            "total": total_steps, 
            "status": f"正在生成分析报告... {progress:.1f}%"
        }
    )
    
    result = {
        "case_id": case_id,
        "evidence_chain_id": f"chain_{case_id}_{random.randint(1000, 9999)}",
        "status": "completed",
        "evidence_count": len(evidence_ids),
        "chain_strength": random.choice(["强", "中等", "弱"]),
        "confidence_score": random.randint(70, 95),
        "gaps_identified": random.randint(0, 3),
        "recommendations": [
            "建议补充时间线相关证据",
            "建议核实关键证据的真实性",
            "建议咨询相关领域专家"
        ],
        "analysis_time": f"{total_steps} seconds"
    }
    
    logger.info(f"证据链生成完成: {result}")
    return result