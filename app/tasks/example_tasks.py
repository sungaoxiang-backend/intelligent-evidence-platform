from app.core.celery_app import celery_app
from loguru import logger
import time

@celery_app.task(bind=True)
def example_task(self, name: str, seconds: int = 5) -> str:
    """
    示例任务：模拟耗时操作
    
    Args:
        name: 任务名称
        seconds: 模拟耗时（秒）
        
    Returns:
        str: 任务完成信息
    """
    logger.info(f"开始执行任务: {name}")
    
    # 模拟耗时操作
    for i in range(seconds):
        time.sleep(1)
        # 更新任务进度
        self.update_state(
            state="PROGRESS",
            meta={"current": i + 1, "total": seconds}
        )
    
    result = f"任务 {name} 已完成，耗时 {seconds} 秒"
    logger.info(result)
    return result

@celery_app.task
def add_numbers(a: int, b: int) -> int:
    """
    简单加法任务
    
    Args:
        a: 第一个数字
        b: 第二个数字
        
    Returns:
        int: 两数之和
    """
    logger.info(f"计算 {a} + {b}")
    result = a + b
    logger.info(f"计算结果: {result}")
    return result

@celery_app.task
def process_document(doc_id: str) -> dict:
    """
    模拟文档处理任务
    
    Args:
        doc_id: 文档ID
        
    Returns:
        dict: 处理结果
    """
    logger.info(f"开始处理文档: {doc_id}")
    
    # 模拟文档处理过程
    time.sleep(3)
    
    result = {
        "doc_id": doc_id,
        "status": "processed",
        "message": f"文档 {doc_id} 处理完成"
    }
    
    logger.info(f"文档处理完成: {result}")
    return result