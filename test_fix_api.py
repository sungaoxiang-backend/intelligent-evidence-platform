#!/usr/bin/env python3
"""
测试模板修复API
"""

import requests
import json

# API基础URL
BASE_URL = "http://localhost:8008/api/v1/template-editor"

def test_fix_all_templates():
    """测试批量修复所有陈述式模板"""
    url = f"{BASE_URL}/debug-fix-all"

    try:
        print("正在调用批量修复API（调试版本，不需要认证）...")

        # 发送POST请求
        response = requests.post(url, headers={"Content-Type": "application/json"})

        print(f"状态码: {response.status_code}")
        print(f"响应: {response.text}")

        if response.status_code == 200:
            data = response.json()
            if data.get("code") == 200:
                result = data.get("data", {})
                print(f"\n✅ 批量修复成功!")
                print(f"总计: {result.get('total', 0)} 个模板")
                print(f"成功: {result.get('fixed', 0)} 个模板")
                print(f"失败: {result.get('failed', 0)} 个模板")
                print(f"跳过: {result.get('skipped', 0)} 个模板")
            else:
                print(f"❌ 修复失败: {data.get('message')}")
        else:
            print(f"❌ 请求失败，状态码: {response.status_code}")

    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到后端服务，请确保后端在端口8008运行")
    except Exception as e:
        print(f"❌ 发生错误: {e}")

def test_get_templates():
    """获取模板列表"""
    url = f"{BASE_URL}/templates"

    try:
        print("正在获取模板列表...")
        response = requests.get(url, headers={"Content-Type": "application/json"})

        print(f"状态码: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            if data.get("code") == 200:
                templates = data.get("data", [])
                print(f"\n找到 {len(templates)} 个模板:")

                for i, template in enumerate(templates):
                    print(f"  {i+1}. ID: {template['id']}, 名称: {template['name']}, 类别: {template.get('category', 'N/A')}")

                # 统计陈述式模板
                narrative_templates = [t for t in templates if t.get('category') and '陈述' in t['category']]
                print(f"\n其中陈述式模板: {len(narrative_templates)} 个")

                if narrative_templates:
                    print("陈述式模板列表:")
                    for template in narrative_templates:
                        print(f"  - ID: {template['id']}, 名称: {template['name']}")
            else:
                print(f"❌ 获取模板失败: {data.get('message')}")
        else:
            print(f"❌ 请求失败，状态码: {response.status_code}")

    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到后端服务，请确保后端在端口8008运行")
    except Exception as e:
        print(f"❌ 发生错误: {e}")

if __name__ == "__main__":
    print("=== 模板修复API测试 ===")

    print("\n1. 获取模板列表")
    test_get_templates()

    print("\n2. 批量修复所有陈述式模板")
    test_fix_all_templates()