#!/usr/bin/env python3
"""
测试真实证据分析任务
"""
import asyncio
from app.tasks.real_evidence_tasks import analyze_evidences_task, batch_analyze_evidences_task

def test_real_task():
    """测试真实证据分析任务"""
    print("开始测试真实证据分析任务...")
    
    # 测试参数
    case_id = 37
    evidence_ids = [144]
    
    try:
        # 测试单个证据分析任务
        print(f"测试单个证据分析任务: case_id={case_id}, evidence_ids={evidence_ids}")
        result = analyze_evidences_task.delay(
            case_id=case_id,
            evidence_ids=evidence_ids,
            auto_classification=True,
            auto_feature_extraction=True
        )
        
        print(f"任务已提交，任务ID: {result.id}")
        print(f"任务状态: {result.status}")
        
        return result.id
        
    except Exception as e:
        print(f"任务提交失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    task_id = test_real_task()
    if task_id:
        print(f"测试完成，任务ID: {task_id}")
    else:
        print("测试失败")
