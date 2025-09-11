#!/usr/bin/env python3
"""
Celery测试脚本
用于验证Celery异步任务功能是否正常工作
"""

import sys
import os

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.celery_app import celery_app
from app.tasks.example_tasks import add_numbers, example_task

def test_celery_connection():
    """测试Celery与Redis的连接"""
    try:
        # 测试连接
        inspect = celery_app.control.inspect()
        stats = inspect.stats()
        if stats:
            print("✓ Celery连接成功")
            return True
        else:
            print("✗ Celery连接失败")
            return False
    except Exception as e:
        print(f"✗ Celery连接错误: {e}")
        return False

def test_simple_task():
    """测试简单任务"""
    try:
        # 发送一个简单的加法任务
        result = add_numbers.delay(3, 5)
        print(f"✓ 任务已发送，ID: {result.id}")
        
        # 等待结果
        task_result = result.get(timeout=10)
        print(f"✓ 任务完成，结果: {task_result}")
        return True
    except Exception as e:
        print(f"✗ 任务执行错误: {e}")
        return False

def main():
    print("开始测试Celery异步任务功能...")
    print(f"Broker URL: {celery_app.conf.broker_url}")
    print(f"Result Backend: {celery_app.conf.result_backend}")
    
    # 测试连接
    if not test_celery_connection():
        print("提示: 如果在本地环境测试，请确保Redis服务已启动")
        print("      或使用Docker环境进行测试")
        return False
    
    # 测试简单任务
    if not test_simple_task():
        return False
    
    print("\n✓ 所有测试通过！Celery异步任务功能正常工作。")
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)