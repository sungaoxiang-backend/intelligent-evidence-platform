#!/usr/bin/env python3
"""
Celery系统完整测试脚本
用于验证Celery异步任务和定时任务功能是否正常工作
"""

import sys
import os
import time

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.celery_app import celery_app
from app.tasks.example_tasks import add_numbers, example_task
from app.tasks.scheduled_tasks import scheduled_hello

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
        result = add_numbers.delay(15, 25)
        print(f"✓ 加法任务已发送，ID: {result.id}")
        
        # 等待结果
        task_result = result.get(timeout=10)
        expected = 40
        if task_result == expected:
            print(f"✓ 加法任务完成，结果正确: {task_result}")
            return True
        else:
            print(f"✗ 加法任务结果错误: 期望 {expected}, 实际 {task_result}")
            return False
    except Exception as e:
        print(f"✗ 加法任务执行错误: {e}")
        return False

def test_long_running_task():
    """测试长时间运行任务"""
    try:
        # 发送一个需要3秒完成的任务
        result = example_task.delay("测试任务", 3)
        print(f"✓ 长时间运行任务已发送，ID: {result.id}")
        
        # 等待结果
        task_result = result.get(timeout=10)
        if "任务 测试任务 已完成，耗时 3 秒" in task_result:
            print(f"✓ 长时间运行任务完成")
            return True
        else:
            print(f"✗ 长时间运行任务结果错误: {task_result}")
            return False
    except Exception as e:
        print(f"✗ 长时间运行任务执行错误: {e}")
        return False

def test_scheduled_task():
    """测试定时任务配置"""
    try:
        # 检查定时任务是否在配置中
        schedule = celery_app.conf.beat_schedule
        if 'say-hello-every-minute' in schedule:
            task_config = schedule['say-hello-every-minute']
            if (task_config['task'] == 'app.tasks.scheduled_tasks.scheduled_hello' and 
                task_config['schedule'] == 60.0):
                print("✓ 定时任务配置正确")
                return True
            else:
                print("✗ 定时任务配置错误")
                return False
        else:
            print("✗ 定时任务未在配置中找到")
            return False
    except Exception as e:
        print(f"✗ 定时任务配置检查错误: {e}")
        return False

def main():
    print("开始测试Celery系统...")
    print("=" * 50)
    
    # 测试连接
    if not test_celery_connection():
        return False
    
    # 测试简单任务
    if not test_simple_task():
        return False
    
    # 测试长时间运行任务
    if not test_long_running_task():
        return False
    
    # 测试定时任务配置
    if not test_scheduled_task():
        return False
    
    print("\n" + "=" * 50)
    print("✓ 所有测试通过！Celery系统正常工作。")
    print("\n系统功能摘要:")
    print("- 异步任务处理: 正常")
    print("- 定时任务调度: 正常")
    print("- Redis连接: 正常")
    print("- 任务结果存储: 正常")
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)