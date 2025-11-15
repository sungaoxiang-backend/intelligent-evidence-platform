"""
后端 API 集成测试：测试完整的模板创建、编辑、发布流程
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestTemplateLifecycle:
    """测试模板生命周期"""
    
    async def test_create_template(self, client: AsyncClient, auth_headers: dict):
        """测试创建模板"""
        response = await client.post(
            "/api/v1/lex-docx",
            json={
                "name": "测试模板",
                "description": "这是一个测试模板",
                "category": "合同",
                "status": "draft",
            },
            headers=auth_headers,
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == 200
        template = data["data"]
        assert template["name"] == "测试模板"
        assert template["status"] == "draft"
        assert template["id"] is not None
        
        return template["id"]
    
    async def test_update_template(self, client: AsyncClient, auth_headers: dict):
        """测试更新模板"""
        # 先创建模板
        create_response = await client.post(
            "/api/v1/lex-docx",
            json={
                "name": "原始模板",
                "status": "draft",
            },
            headers=auth_headers,
        )
        template_id = create_response.json()["data"]["id"]
        
        # 更新模板
        response = await client.put(
            f"/api/v1/lex-docx/{template_id}",
            json={
                "name": "更新后的模板",
                "description": "更新后的描述",
                "category": "协议",
            },
            headers=auth_headers,
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == 200
        template = data["data"]
        assert template["name"] == "更新后的模板"
        assert template["description"] == "更新后的描述"
        assert template["category"] == "协议"
    
    async def test_update_template_content(
        self, client: AsyncClient, auth_headers: dict
    ):
        """测试更新模板内容"""
        # 先创建模板
        create_response = await client.post(
            "/api/v1/lex-docx",
            json={
                "name": "内容测试模板",
                "status": "draft",
            },
            headers=auth_headers,
        )
        template_id = create_response.json()["data"]["id"]
        
        # 更新模板内容
        html_content = "<p>这是模板内容，包含占位符 {{client_name}} 和 {{amount}}。</p>"
        placeholder_metadata = {
            "client_name": {
                "type": "text",
                "label": "客户名称",
                "required": True,
            },
            "amount": {
                "type": "number",
                "label": "金额",
                "required": True,
            },
        }
        
        response = await client.put(
            f"/api/v1/lex-docx/{template_id}",
            json={
                "content_html": html_content,
                "placeholder_metadata": placeholder_metadata,
            },
            headers=auth_headers,
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == 200
        template = data["data"]
        assert template["content_html"] == html_content
        assert template["placeholder_metadata"] is not None
        assert "client_name" in template["placeholder_metadata"]
        assert "amount" in template["placeholder_metadata"]
    
    async def test_publish_template(
        self, client: AsyncClient, auth_headers: dict, superuser_headers: dict
    ):
        """测试发布模板（需要超级管理员权限）"""
        # 先创建模板
        create_response = await client.post(
            "/api/v1/lex-docx",
            json={
                "name": "待发布模板",
                "status": "draft",
                "content_html": "<p>模板内容 {{name}}</p>",
                "placeholder_metadata": {
                    "name": {
                        "type": "text",
                        "label": "名称",
                        "required": True,
                    },
                },
            },
            headers=auth_headers,
        )
        template_id = create_response.json()["data"]["id"]
        
        # 普通用户无法发布
        response = await client.put(
            f"/api/v1/lex-docx/{template_id}/status",
            json={"status": "published"},
            headers=auth_headers,
        )
        assert response.status_code == 403
        
        # 超级管理员可以发布
        response = await client.put(
            f"/api/v1/lex-docx/{template_id}/status",
            json={"status": "published"},
            headers=superuser_headers,
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == 200
        template = data["data"]
        assert template["status"] == "published"
    
    async def test_get_template(self, client: AsyncClient, auth_headers: dict):
        """测试获取模板详情"""
        # 先创建模板
        create_response = await client.post(
            "/api/v1/lex-docx",
            json={
                "name": "获取测试模板",
                "description": "用于测试获取功能",
            },
            headers=auth_headers,
        )
        template_id = create_response.json()["data"]["id"]
        
        # 获取模板
        response = await client.get(
            f"/api/v1/lex-docx/{template_id}",
            headers=auth_headers,
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == 200
        template = data["data"]
        assert template["id"] == template_id
        assert template["name"] == "获取测试模板"
    
    async def test_list_templates(self, client: AsyncClient, auth_headers: dict):
        """测试获取模板列表"""
        # 创建几个模板
        for i in range(3):
            await client.post(
                "/api/v1/lex-docx",
                json={
                    "name": f"列表测试模板 {i+1}",
                    "status": "draft",
                },
                headers=auth_headers,
            )
        
        # 获取列表
        response = await client.get(
            "/api/v1/lex-docx?skip=0&limit=10",
            headers=auth_headers,
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == 200
        assert "data" in data
        assert "pagination" in data
        templates = data["data"]
        assert len(templates) >= 3
    
    async def test_delete_template(self, client: AsyncClient, auth_headers: dict):
        """测试删除模板"""
        # 先创建模板
        create_response = await client.post(
            "/api/v1/lex-docx",
            json={
                "name": "待删除模板",
                "status": "draft",
            },
            headers=auth_headers,
        )
        template_id = create_response.json()["data"]["id"]
        
        # 删除模板
        response = await client.delete(
            f"/api/v1/lex-docx/{template_id}",
            headers=auth_headers,
        )
        
        assert response.status_code == 200
        
        # 验证模板已删除
        response = await client.get(
            f"/api/v1/lex-docx/{template_id}",
            headers=auth_headers,
        )
        assert response.status_code == 404
    
    async def test_full_lifecycle(
        self, client: AsyncClient, auth_headers: dict, superuser_headers: dict
    ):
        """测试完整的模板生命周期：创建 -> 编辑 -> 发布"""
        # 1. 创建模板
        create_response = await client.post(
            "/api/v1/lex-docx",
            json={
                "name": "完整生命周期测试模板",
                "description": "测试完整流程",
                "category": "测试",
                "status": "draft",
            },
            headers=auth_headers,
        )
        assert create_response.status_code == 200
        template_id = create_response.json()["data"]["id"]
        
        # 2. 更新模板内容
        update_response = await client.put(
            f"/api/v1/lex-docx/{template_id}",
            json={
                "content_html": "<p>模板内容 {{name}} {{date}}</p>",
                "placeholder_metadata": {
                    "name": {
                        "type": "text",
                        "label": "名称",
                        "required": True,
                    },
                    "date": {
                        "type": "date",
                        "label": "日期",
                        "required": False,
                    },
                },
            },
            headers=auth_headers,
        )
        assert update_response.status_code == 200
        
        # 3. 发布模板（需要超级管理员）
        publish_response = await client.put(
            f"/api/v1/lex-docx/{template_id}/status",
            json={"status": "published"},
            headers=superuser_headers,
        )
        assert publish_response.status_code == 200
        assert publish_response.json()["data"]["status"] == "published"
        
        # 4. 验证已发布的模板不能修改内容
        update_response = await client.put(
            f"/api/v1/lex-docx/{template_id}",
            json={
                "content_html": "<p>修改后的内容</p>",
            },
            headers=auth_headers,
        )
        assert update_response.status_code == 400
        assert "已发布" in update_response.json()["detail"]
        
        # 5. 验证已发布的模板不能删除
        delete_response = await client.delete(
            f"/api/v1/lex-docx/{template_id}",
            headers=auth_headers,
        )
        assert delete_response.status_code == 400
        assert "已发布" in delete_response.json()["detail"]
        
        # 6. 获取已发布的模板列表
        published_response = await client.get(
            "/api/v1/lex-docx/published",
            headers=auth_headers,
        )
        assert published_response.status_code == 200
        published_templates = published_response.json()["data"]
        assert any(t["id"] == template_id for t in published_templates)

