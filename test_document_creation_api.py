#!/usr/bin/env python3
"""
测试文书制作和草稿管理 API
"""

import requests
import json
from typing import Optional

# API基础URL
BASE_URL = "http://localhost:8008/api/v1"

# 测试用的认证token（需要从实际登录获取）
TOKEN = None

def get_auth_headers():
    """获取认证头"""
    if TOKEN:
        return {"Authorization": f"Bearer {TOKEN}"}
    return {}

def test_login():
    """测试登录获取token"""
    global TOKEN
    url = f"{BASE_URL}/login/access-token"
    # 使用 form-data 格式
    data = {
        "username": "admin",
        "password": "admin123"
    }
    
    try:
        response = requests.post(url, data=data)
        if response.status_code == 200:
            result = response.json()
            # 处理 SingleResponse 格式: {"code": 200, "data": {"access_token": "...", "token_type": "bearer"}}
            if result.get("code") == 200 and result.get("data"):
                TOKEN = result["data"].get("access_token")
                if TOKEN:
                    print(f"✅ 登录成功，Token: {TOKEN[:20]}...")
                    return True
            # 也支持直接返回 access_token 的情况
            elif result.get("access_token"):
                TOKEN = result.get("access_token")
                print(f"✅ 登录成功，Token: {TOKEN[:20]}...")
                return True
            else:
                print(f"❌ 登录响应格式异常: {result}")
                return False
        else:
            print(f"❌ 登录失败: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ 登录异常: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_get_published_documents():
    """测试获取已发布模板列表"""
    url = f"{BASE_URL}/documents/published"
    
    try:
        response = requests.get(url, headers=get_auth_headers())
        print(f"\n📄 测试获取已发布模板列表")
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ 成功获取已发布模板列表")
            print(f"  总数: {data.get('total', 0)}")
            print(f"  模板数量: {len(data.get('data', []))}")
            if data.get('data'):
                print(f"  第一个模板: {data['data'][0].get('name')} (ID: {data['data'][0].get('id')})")
            return data.get('data', [])
        else:
            print(f"❌ 失败: {response.text}")
            return []
    except Exception as e:
        print(f"❌ 异常: {e}")
        return []

def test_get_cases():
    """测试获取案件列表"""
    url = f"{BASE_URL}/cases"
    
    try:
        response = requests.get(url, headers=get_auth_headers(), params={"skip": 0, "limit": 10})
        print(f"\n📋 测试获取案件列表")
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            cases = data.get('data', [])
            print(f"✅ 成功获取案件列表")
            print(f"  案件数量: {len(cases)}")
            if cases:
                print(f"  第一个案件: ID {cases[0].get('id')}")
            return cases
        else:
            print(f"❌ 失败: {response.text}")
            return []
    except Exception as e:
        print(f"❌ 异常: {e}")
        return []

def test_create_draft(case_id: int, document_id: int):
    """测试创建草稿"""
    url = f"{BASE_URL}/document-drafts"
    data = {
        "case_id": case_id,
        "document_id": document_id,
        "form_data": {
            "test_field": "test_value",
            "test_field2": "test_value2"
        }
    }
    
    try:
        response = requests.post(url, json=data, headers=get_auth_headers())
        print(f"\n💾 测试创建草稿 (case_id={case_id}, document_id={document_id})")
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 201:
            result = response.json()
            print(f"✅ 成功创建草稿")
            print(f"  草稿ID: {result.get('data', {}).get('id')}")
            return result.get('data')
        else:
            print(f"❌ 失败: {response.text}")
            return None
    except Exception as e:
        print(f"❌ 异常: {e}")
        return None

def test_get_draft(case_id: int, document_id: int):
    """测试获取草稿"""
    url = f"{BASE_URL}/document-drafts"
    params = {
        "case_id": case_id,
        "document_id": document_id
    }
    
    try:
        response = requests.get(url, params=params, headers=get_auth_headers())
        print(f"\n📖 测试获取草稿 (case_id={case_id}, document_id={document_id})")
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            if result.get('data'):
                print(f"✅ 成功获取草稿")
                print(f"  草稿ID: {result.get('data', {}).get('id')}")
                print(f"  表单数据: {json.dumps(result.get('data', {}).get('form_data', {}), ensure_ascii=False)}")
                return result.get('data')
            else:
                print(f"⚠️  草稿不存在")
                return None
        elif response.status_code == 404:
            print(f"⚠️  草稿不存在（404）")
            return None
        else:
            print(f"❌ 失败: {response.text}")
            return None
    except Exception as e:
        print(f"❌ 异常: {e}")
        return None

def test_update_draft(case_id: int, document_id: int):
    """测试更新草稿（使用create_or_update接口）"""
    url = f"{BASE_URL}/document-drafts"
    data = {
        "case_id": case_id,
        "document_id": document_id,
        "form_data": {
            "test_field": "updated_value",
            "test_field2": "updated_value2",
            "new_field": "new_value"
        }
    }
    
    try:
        response = requests.post(url, json=data, headers=get_auth_headers())
        print(f"\n🔄 测试更新草稿 (case_id={case_id}, document_id={document_id})")
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 201:
            result = response.json()
            print(f"✅ 成功更新草稿")
            print(f"  草稿ID: {result.get('data', {}).get('id')}")
            print(f"  更新后的表单数据: {json.dumps(result.get('data', {}).get('form_data', {}), ensure_ascii=False)}")
            return result.get('data')
        else:
            print(f"❌ 失败: {response.text}")
            return None
    except Exception as e:
        print(f"❌ 异常: {e}")
        return None

def test_list_drafts_by_case(case_id: int):
    """测试获取某个案件的所有草稿"""
    url = f"{BASE_URL}/document-drafts/case/{case_id}"
    
    try:
        response = requests.get(url, headers=get_auth_headers())
        print(f"\n📚 测试获取案件的所有草稿 (case_id={case_id})")
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            drafts = result.get('data', [])
            print(f"✅ 成功获取草稿列表")
            print(f"  草稿数量: {len(drafts)}")
            for draft in drafts:
                print(f"  - 草稿ID: {draft.get('id')}, 模板ID: {draft.get('document_id')}")
            return drafts
        else:
            print(f"❌ 失败: {response.text}")
            return []
    except Exception as e:
        print(f"❌ 异常: {e}")
        return []

def test_generate_document(case_id: int, document_id: int):
    """测试生成填充后的文档"""
    url = f"{BASE_URL}/document-creation/generate"
    data = {
        "case_id": case_id,
        "document_id": document_id,
        "form_data": {
            "test_field": "generated_value",
            "test_field2": "generated_value2"
        }
    }
    
    try:
        response = requests.post(url, json=data, headers=get_auth_headers())
        print(f"\n📝 测试生成文档 (case_id={case_id}, document_id={document_id})")
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ 成功生成文档")
            print(f"  文档内容类型: {type(result.get('data'))}")
            if isinstance(result.get('data'), dict):
                print(f"  文档节点类型: {result.get('data', {}).get('type', 'unknown')}")
            return result.get('data')
        else:
            print(f"❌ 失败: {response.text}")
            return None
    except Exception as e:
        print(f"❌ 异常: {e}")
        return None

def test_delete_draft(draft_id: int):
    """测试删除草稿"""
    url = f"{BASE_URL}/document-drafts/{draft_id}"
    
    try:
        response = requests.delete(url, headers=get_auth_headers())
        print(f"\n🗑️  测试删除草稿 (draft_id={draft_id})")
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 204:
            print(f"✅ 成功删除草稿")
            return True
        else:
            print(f"❌ 失败: {response.text}")
            return False
    except Exception as e:
        print(f"❌ 异常: {e}")
        return False

def main():
    """主测试函数"""
    print("=" * 60)
    print("开始测试文书制作和草稿管理 API")
    print("=" * 60)
    
    # 1. 登录获取token
    if not test_login():
        print("\n❌ 无法登录，请检查用户名和密码")
        return
    
    # 2. 获取已发布模板列表
    documents = test_get_published_documents()
    if not documents:
        print("\n⚠️  没有已发布的模板，无法继续测试")
        return
    
    document_id = documents[0].get('id')
    print(f"\n使用模板ID: {document_id}")
    
    # 3. 获取案件列表
    cases = test_get_cases()
    if not cases:
        print("\n⚠️  没有案件，无法继续测试")
        return
    
    case_id = cases[0].get('id')
    print(f"\n使用案件ID: {case_id}")
    
    # 4. 创建草稿
    draft = test_create_draft(case_id, document_id)
    if not draft:
        print("\n⚠️  创建草稿失败，但继续测试...")
    else:
        draft_id = draft.get('id')
        
        # 5. 获取草稿
        test_get_draft(case_id, document_id)
        
        # 6. 更新草稿
        test_update_draft(case_id, document_id)
        
        # 7. 再次获取草稿验证更新
        test_get_draft(case_id, document_id)
        
        # 8. 获取案件的所有草稿
        test_list_drafts_by_case(case_id)
        
        # 9. 生成文档
        test_generate_document(case_id, document_id)
        
        # 10. 删除草稿
        test_delete_draft(draft_id)
        
        # 11. 验证删除后无法获取
        test_get_draft(case_id, document_id)
    
    print("\n" + "=" * 60)
    print("测试完成")
    print("=" * 60)

if __name__ == "__main__":
    main()

