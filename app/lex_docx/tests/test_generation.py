"""
文档生成功能的单元测试
"""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from app.lex_docx.models import TemplateStatus
from app.lex_docx.schemas import DocumentGenerationCreate, GenerationListQuery
from app.lex_docx.services import (
    generate_document,
    get_generation_by_id,
    list_generations,
)


class TestGenerateDocument:
    """测试文档生成功能"""
    
    @pytest.mark.asyncio
    async def test_generate_document_template_not_found(self):
        """测试模板不存在"""
        db = AsyncMock()
        obj_in = DocumentGenerationCreate(
            template_id=999,
            form_data={"name": "Test"}
        )
        
        from app.lex_docx import services
        original_get = services.get_template_by_id
        services.get_template_by_id = AsyncMock(return_value=None)
        
        try:
            with pytest.raises(HTTPException) as exc_info:
                await generate_document(db, obj_in, 1)
            
            assert exc_info.value.status_code == 404
            assert "不存在" in exc_info.value.detail
        finally:
            services.get_template_by_id = original_get
    
    @pytest.mark.asyncio
    async def test_generate_document_template_not_published(self):
        """测试模板未发布"""
        db = AsyncMock()
        template = MagicMock()
        template.id = 1
        template.status = TemplateStatus.DRAFT
        template.content_path = None
        
        obj_in = DocumentGenerationCreate(
            template_id=1,
            form_data={"name": "Test"}
        )
        
        from app.lex_docx import services
        original_get = services.get_template_by_id
        services.get_template_by_id = AsyncMock(return_value=template)
        
        try:
            with pytest.raises(HTTPException) as exc_info:
                await generate_document(db, obj_in, 1)
            
            assert exc_info.value.status_code == 400
            assert "已发布" in exc_info.value.detail
        finally:
            services.get_template_by_id = original_get
    
    @pytest.mark.asyncio
    async def test_generate_document_missing_required_fields(self):
        """测试缺少必填字段"""
        db = AsyncMock()
        template = MagicMock()
        template.id = 1
        template.status = TemplateStatus.PUBLISHED
        template.content_path = "templates/document-templates/1.docx"
        template.placeholder_metadata = {
            "name": {"type": "text", "label": "姓名", "required": True},
            "age": {"type": "number", "label": "年龄", "required": False}
        }
        
        obj_in = DocumentGenerationCreate(
            template_id=1,
            form_data={"age": "25"}  # 缺少必填字段 name
        )
        
        from app.lex_docx import services
        original_get = services.get_template_by_id
        services.get_template_by_id = AsyncMock(return_value=template)
        
        try:
            with pytest.raises(HTTPException) as exc_info:
                await generate_document(db, obj_in, 1)
            
            assert exc_info.value.status_code == 400
            assert "必填字段" in exc_info.value.detail
        finally:
            services.get_template_by_id = original_get
    
    @pytest.mark.asyncio
    async def test_generate_document_no_template_file(self):
        """测试模板文件不存在"""
        db = AsyncMock()
        template = MagicMock()
        template.id = 1
        template.status = TemplateStatus.PUBLISHED
        template.content_path = None
        template.placeholder_metadata = {}
        
        obj_in = DocumentGenerationCreate(
            template_id=1,
            form_data={"name": "Test"}
        )
        
        from app.lex_docx import services
        original_get = services.get_template_by_id
        services.get_template_by_id = AsyncMock(return_value=template)
        
        try:
            with pytest.raises(HTTPException) as exc_info:
                await generate_document(db, obj_in, 1)
            
            assert exc_info.value.status_code == 400
            assert "模板文件不存在" in exc_info.value.detail
        finally:
            services.get_template_by_id = original_get
    
    @pytest.mark.asyncio
    async def test_generate_document_success(self):
        """测试成功生成文档"""
        db = AsyncMock()
        template = MagicMock()
        template.id = 1
        template.name = "Test Template"
        template.status = TemplateStatus.PUBLISHED
        template.content_path = "templates/document-templates/1.docx"
        template.placeholder_metadata = {
            "name": {"type": "text", "label": "姓名", "required": True}
        }
        
        obj_in = DocumentGenerationCreate(
            template_id=1,
            form_data={"name": "Test User"}
        )
        
        # Mock 生成记录
        generation = MagicMock()
        generation.id = 1
        generation.template_id = 1
        generation.generated_by = 1
        generation.form_data = obj_in.form_data
        generation.document_url = "https://cos.example.com/document.docx"
        generation.document_filename = "Test Template_20240101120000.docx"
        
        from app.lex_docx import services
        original_get = services.get_template_by_id
        services.get_template_by_id = AsyncMock(return_value=template)
        
        # Mock 文件存在
        with patch("pathlib.Path.exists", return_value=True):
            # Mock DocxTemplate
            with patch("app.lex_docx.services.DocxTemplate") as mock_docx_template:
                mock_doc = MagicMock()
                mock_docx_template.return_value = mock_doc
                
                # Mock COS 上传
                with patch("app.lex_docx.services.cos_service") as mock_cos:
                    mock_cos.upload_file.return_value = "https://cos.example.com/document.docx"
                    
                    db.add = MagicMock()
                    db.commit = AsyncMock()
                    db.refresh = AsyncMock()
                    
                    try:
                        result = await generate_document(db, obj_in, 1)
                        
                        # 验证调用了相关方法
                        mock_doc.render.assert_called_once()
                        mock_doc.save.assert_called_once()
                        mock_cos.upload_file.assert_called_once()
                        db.add.assert_called_once()
                        db.commit.assert_called_once()
                    finally:
                        services.get_template_by_id = original_get


class TestGetGenerationById:
    """测试获取生成记录功能"""
    
    @pytest.mark.asyncio
    async def test_get_generation_by_id_success(self):
        """测试成功获取生成记录"""
        db = AsyncMock()
        generation = MagicMock()
        generation.id = 1
        
        db.execute = AsyncMock()
        db.scalars = MagicMock()
        db.scalars.return_value.first = AsyncMock(return_value=generation)
        
        result = await get_generation_by_id(db, 1)
        assert result == generation
    
    @pytest.mark.asyncio
    async def test_get_generation_by_id_not_found(self):
        """测试生成记录不存在"""
        db = AsyncMock()
        db.execute = AsyncMock()
        db.scalars = MagicMock()
        db.scalars.return_value.first = AsyncMock(return_value=None)
        
        result = await get_generation_by_id(db, 999)
        assert result is None


class TestListGenerations:
    """测试获取生成记录列表功能"""
    
    @pytest.mark.asyncio
    async def test_list_generations_success(self):
        """测试成功获取生成记录列表"""
        db = AsyncMock()
        query_params = GenerationListQuery(
            skip=0,
            limit=10
        )
        
        generation1 = MagicMock()
        generation1.id = 1
        generation2 = MagicMock()
        generation2.id = 2
        
        db.execute = AsyncMock(side_effect=[
            MagicMock(scalar_one=lambda: 2),  # count query
            MagicMock(scalars=lambda: MagicMock(all=lambda: [generation1, generation2]))  # data query
        ])
        
        generations, total = await list_generations(db, query_params)
        
        assert total == 2
        assert len(generations) == 2
        assert generations[0].id == 1
        assert generations[1].id == 2
    
    @pytest.mark.asyncio
    async def test_list_generations_with_filters(self):
        """测试带筛选条件的列表查询"""
        db = AsyncMock()
        query_params = GenerationListQuery(
            template_id=1,
            generated_by=2,
            skip=0,
            limit=10
        )
        
        db.execute = AsyncMock(side_effect=[
            MagicMock(scalar_one=lambda: 1),  # count query
            MagicMock(scalars=lambda: MagicMock(all=lambda: [MagicMock(id=1)]))  # data query
        ])
        
        generations, total = await list_generations(db, query_params)
        
        assert total == 1
        assert len(generations) == 1

