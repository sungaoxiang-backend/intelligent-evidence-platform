"""
模板状态管理功能的单元测试
"""
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.lex_docx.models import TemplateStatus
from app.lex_docx.services import update_template_status


class TestUpdateTemplateStatus:
    """测试模板状态更新功能"""
    
    @pytest.mark.asyncio
    async def test_update_status_requires_superuser(self):
        """测试非超级管理员无法切换状态"""
        db = AsyncMock()
        
        with pytest.raises(HTTPException) as exc_info:
            await update_template_status(
                db=db,
                template_id=1,
                new_status=TemplateStatus.PUBLISHED,
                updated_by=1,
                is_superuser=False,
            )
        
        assert exc_info.value.status_code == 403
        assert "超级管理员" in exc_info.value.detail
    
    @pytest.mark.asyncio
    async def test_update_status_template_not_found(self):
        """测试模板不存在的情况"""
        db = AsyncMock()
        # Mock get_template_by_id 返回 None
        from app.lex_docx import services
        original_get = services.get_template_by_id
        services.get_template_by_id = AsyncMock(return_value=None)
        
        try:
            with pytest.raises(HTTPException) as exc_info:
                await update_template_status(
                    db=db,
                    template_id=999,
                    new_status=TemplateStatus.PUBLISHED,
                    updated_by=1,
                    is_superuser=True,
                )
            
            assert exc_info.value.status_code == 404
            assert "不存在" in exc_info.value.detail
        finally:
            services.get_template_by_id = original_get
    
    @pytest.mark.asyncio
    async def test_update_status_invalid_status(self):
        """测试无效的状态值"""
        db = AsyncMock()
        template = MagicMock()
        template.status = TemplateStatus.DRAFT
        
        from app.lex_docx import services
        original_get = services.get_template_by_id
        services.get_template_by_id = AsyncMock(return_value=template)
        
        try:
            with pytest.raises(HTTPException) as exc_info:
                await update_template_status(
                    db=db,
                    template_id=1,
                    new_status="invalid_status",
                    updated_by=1,
                    is_superuser=True,
                )
            
            assert exc_info.value.status_code == 400
            assert "无效的状态值" in exc_info.value.detail
        finally:
            services.get_template_by_id = original_get
    
    @pytest.mark.asyncio
    async def test_update_status_no_placeholders(self):
        """测试发布没有占位符的模板"""
        db = AsyncMock()
        template = MagicMock()
        template.status = TemplateStatus.DRAFT
        template.content_html = "<p>Hello World</p>"  # 没有占位符
        template.placeholder_metadata = {}
        
        from app.lex_docx import services
        original_get = services.get_template_by_id
        services.get_template_by_id = AsyncMock(return_value=template)
        
        try:
            with pytest.raises(HTTPException) as exc_info:
                await update_template_status(
                    db=db,
                    template_id=1,
                    new_status=TemplateStatus.PUBLISHED,
                    updated_by=1,
                    is_superuser=True,
                )
            
            assert exc_info.value.status_code == 400
            assert "占位符" in exc_info.value.detail
        finally:
            services.get_template_by_id = original_get
    
    @pytest.mark.asyncio
    async def test_update_status_no_content(self):
        """测试发布内容为空的模板"""
        db = AsyncMock()
        template = MagicMock()
        template.status = TemplateStatus.DRAFT
        template.content_html = None
        
        from app.lex_docx import services
        original_get = services.get_template_by_id
        services.get_template_by_id = AsyncMock(return_value=template)
        
        try:
            with pytest.raises(HTTPException) as exc_info:
                await update_template_status(
                    db=db,
                    template_id=1,
                    new_status=TemplateStatus.PUBLISHED,
                    updated_by=1,
                    is_superuser=True,
                )
            
            assert exc_info.value.status_code == 400
            assert "内容为空" in exc_info.value.detail
        finally:
            services.get_template_by_id = original_get
    
    @pytest.mark.asyncio
    async def test_update_status_no_metadata(self):
        """测试发布没有元数据的模板"""
        db = AsyncMock()
        template = MagicMock()
        template.status = TemplateStatus.DRAFT
        template.content_html = "<p>Hello {{name}}</p>"
        template.placeholder_metadata = None  # 没有元数据
        
        from app.lex_docx import services
        original_get = services.get_template_by_id
        services.get_template_by_id = AsyncMock(return_value=template)
        
        try:
            with pytest.raises(HTTPException) as exc_info:
                await update_template_status(
                    db=db,
                    template_id=1,
                    new_status=TemplateStatus.PUBLISHED,
                    updated_by=1,
                    is_superuser=True,
                )
            
            assert exc_info.value.status_code == 400
            assert "元数据" in exc_info.value.detail
        finally:
            services.get_template_by_id = original_get
    
    @pytest.mark.asyncio
    async def test_update_status_draft_to_published_success(self):
        """测试从草稿成功发布模板"""
        db = AsyncMock()
        template = MagicMock()
        template.status = TemplateStatus.DRAFT
        template.content_html = "<p>Hello {{name}}</p>"
        template.placeholder_metadata = {"name": {"type": "text", "label": "Name", "required": False}}
        template.updated_by = None
        
        from app.lex_docx import services
        original_get = services.get_template_by_id
        services.get_template_by_id = AsyncMock(return_value=template)
        
        try:
            result = await update_template_status(
                db=db,
                template_id=1,
                new_status=TemplateStatus.PUBLISHED,
                updated_by=1,
                is_superuser=True,
            )
            
            assert result.status == TemplateStatus.PUBLISHED
            assert result.updated_by == 1
            db.add.assert_called_once()
            db.commit.assert_called_once()
        finally:
            services.get_template_by_id = original_get
    
    @pytest.mark.asyncio
    async def test_update_status_published_to_draft_success(self):
        """测试从已发布切换为草稿"""
        db = AsyncMock()
        template = MagicMock()
        template.status = TemplateStatus.PUBLISHED
        template.content_html = "<p>Hello {{name}}</p>"
        template.placeholder_metadata = {"name": {"type": "text", "label": "Name", "required": False}}
        
        from app.lex_docx import services
        original_get = services.get_template_by_id
        services.get_template_by_id = AsyncMock(return_value=template)
        
        try:
            result = await update_template_status(
                db=db,
                template_id=1,
                new_status=TemplateStatus.DRAFT,
                updated_by=1,
                is_superuser=True,
            )
            
            assert result.status == TemplateStatus.DRAFT
            assert result.updated_by == 1
            db.add.assert_called_once()
            db.commit.assert_called_once()
        finally:
            services.get_template_by_id = original_get
    
    @pytest.mark.asyncio
    async def test_update_status_same_status(self):
        """测试状态没有变化的情况"""
        db = AsyncMock()
        template = MagicMock()
        template.status = TemplateStatus.PUBLISHED
        template.content_html = "<p>Hello {{name}}</p>"
        template.placeholder_metadata = {"name": {"type": "text", "label": "Name", "required": False}}
        
        from app.lex_docx import services
        original_get = services.get_template_by_id
        services.get_template_by_id = AsyncMock(return_value=template)
        
        try:
            result = await update_template_status(
                db=db,
                template_id=1,
                new_status=TemplateStatus.PUBLISHED,
                updated_by=1,
                is_superuser=True,
            )
            
            assert result.status == TemplateStatus.PUBLISHED
            # 状态没有变化，不应该调用 commit（因为提前返回了）
            # 注意：由于提前返回，不会执行到 commit
        finally:
            services.get_template_by_id = original_get

