#!/usr/bin/env python3
"""
简单的Celery测试脚本
用于验证Celery配置是否正确
"""

import sys
import os

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def test_celery_import():
    """测试Celery模块导入"""
    try:
        from app.core.celery_app import celery_app
        print("✓ Celery模块导入成功")
        return True
    except Exception as e:
        print(f"✗ Celery模块导入失败: {e}")
        return False

def test_celery_config():
    """测试Celery配置"""
    try:
        from app.core.celery_app import celery_app
        broker_url = celery_app.conf.broker_url
        result_backend = celery_app.conf.result_backend
        print(f"✓ Broker URL: {broker_url}")
        print(f"✓ Result Backend: {result_backend}")
        return True
    except Exception as e:
        print(f"✗ Celery配置测试失败: {e}")
        return False

def main():
    print("开始测试Celery配置...")
    
    # 测试模块导入
    if not test_celery_import():
        return False
    
    # 测试配置
    if not test_celery_config():
        return False
    
    print("\n✓ 所有测试通过！Celery配置正确。")
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)