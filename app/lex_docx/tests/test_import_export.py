"""
模板导入导出功能的单元测试
"""
from io import BytesIO
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException, UploadFile

from app.lex_docx.services import export_template, import_template


class TestImportTemplate:
    """测试模板导入功能"""
    
    @pytest.mark.asyncio
    async def test_import_template_success(self):
        """测试成功导入模板"""
        db = AsyncMock()
        
        # 创建模拟的 DOCX 文件内容
        from docx import Document
        doc = Document()
        doc.add_paragraph("Hello {{name}}, your age is {{age}}.")
        docx_bytes = BytesIO()
        doc.save(docx_bytes)
        docx_bytes.seek(0)
        
        # 创建 UploadFile 模拟对象
        upload_file = UploadFile(
            filename="test_template.docx",
            file=BytesIO(docx_bytes.read())
        )
        
        # Mock create_template
        from app.lex_docx import services
        original_create = services.create_template
        mock_template = MagicMock()
        mock_template.id = 1
        mock_template.name = "test_template"
        services.create_template = AsyncMock(return_value=mock_template)
        
        try:
            result = await import_template(
                db=db,
                file=upload_file,
                created_by=1,
                name="Test Template",
            )
            
            assert result.id == 1
            services.create_template.assert_called_once()
        finally:
            services.create_template = original_create
    
    @pytest.mark.asyncio
    async def test_import_template_invalid_file_type(self):
        """测试无效的文件类型"""
        db = AsyncMock()
        
        upload_file = UploadFile(
            filename="test.txt",
            file=BytesIO(b"test content")
        )
        
        with pytest.raises(HTTPException) as exc_info:
            await import_template(
                db=db,
                file=upload_file,
                created_by=1,
            )
        
        assert exc_info.value.status_code == 400
        assert "DOCX" in exc_info.value.detail
    
    @pytest.mark.asyncio
    async def test_import_template_file_too_large(self):
        """测试文件过大"""
        db = AsyncMock()
        
        # 创建超过 10MB 的文件内容
        large_content = b"x" * (11 * 1024 * 1024)  # 11MB
        
        upload_file = UploadFile(
            filename="large_template.docx",
            file=BytesIO(large_content)
        )
        
        with pytest.raises(HTTPException) as exc_info:
            await import_template(
                db=db,
                file=upload_file,
                created_by=1,
            )
        
        assert exc_info.value.status_code == 400
        assert "大小" in exc_info.value.detail
    
    @pytest.mark.asyncio
    async def test_import_template_no_filename(self):
        """测试文件名为空"""
        db = AsyncMock()
        
        upload_file = UploadFile(
            filename=None,
            file=BytesIO(b"test content")
        )
        
        with pytest.raises(HTTPException) as exc_info:
            await import_template(
                db=db,
                file=upload_file,
                created_by=1,
            )
        
        assert exc_info.value.status_code == 400
        assert "文件名为空" in exc_info.value.detail


class TestExportTemplate:
    """测试模板导出功能"""
    
    @pytest.mark.asyncio
    async def test_export_template_from_file(self):
        """测试从文件导出模板"""
        db = AsyncMock()
        template = MagicMock()
        template.id = 1
        template.content_path = "templates/document-templates/1.docx"
        template.content_html = None
        
        # Mock get_template_by_id
        from app.lex_docx import services
        original_get = services.get_template_by_id
        services.get_template_by_id = AsyncMock(return_value=template)
        
        # Mock 文件读取
        test_content = b"test docx content"
        with patch("pathlib.Path.read_bytes", return_value=test_content):
            with patch("pathlib.Path.exists", return_value=True):
                try:
                    result = await export_template(db, 1)
                    assert result == test_content
                finally:
                    services.get_template_by_id = original_get
    
    @pytest.mark.asyncio
    async def test_export_template_from_html(self):
        """测试从 HTML 导出模板"""
        db = AsyncMock()
        template = MagicMock()
        template.id = 1
        template.content_path = None
        template.content_html = "<p>Hello {{name}}</p>"
        
        # Mock get_template_by_id
        from app.lex_docx import services
        original_get = services.get_template_by_id
        services.get_template_by_id = AsyncMock(return_value=template)
        
        try:
            result = await export_template(db, 1)
            assert isinstance(result, bytes)
            assert len(result) > 0
        finally:
            services.get_template_by_id = original_get
    
    @pytest.mark.asyncio
    async def test_export_template_not_found(self):
        """测试模板不存在"""
        db = AsyncMock()
        
        from app.lex_docx import services
        original_get = services.get_template_by_id
        services.get_template_by_id = AsyncMock(return_value=None)
        
        try:
            with pytest.raises(HTTPException) as exc_info:
                await export_template(db, 999)
            
            assert exc_info.value.status_code == 404
            assert "不存在" in exc_info.value.detail
        finally:
            services.get_template_by_id = original_get
    
    @pytest.mark.asyncio
    async def test_export_template_no_content(self):
        """测试模板没有可导出内容"""
        db = AsyncMock()
        template = MagicMock()
        template.id = 1
        template.content_path = None
        template.content_html = None
        
        from app.lex_docx import services
        original_get = services.get_template_by_id
        services.get_template_by_id = AsyncMock(return_value=template)
        
        try:
            with pytest.raises(HTTPException) as exc_info:
                await export_template(db, 1)
            
            assert exc_info.value.status_code == 400
            assert "可导出的内容" in exc_info.value.detail
        finally:
            services.get_template_by_id = original_get

