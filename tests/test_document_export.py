"""
测试文书生成和导出功能
"""
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, Mock, patch
import io
from datetime import datetime
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import event

from app.core.config import settings
from app.db.base import Base
from app.document_generation.services import document_generation_service
from app.document_generation.models import DocumentGeneration
from app.template_editor.models import DocumentTemplate, TemplatePlaceholder
from app.cases.models import Case, CaseStatus
from app.users.models import User
from app.staffs.models import Staff


@pytest_asyncio.fixture
async def async_db_session():
    """创建测试数据库会话 - 使用嵌套事务隔离
    
    ⚠️ 重要：
    1. 测试数据会被自动回滚，不会污染生产数据库
    2. 所有测试操作都在一个事务中进行
    3. 测试结束后自动回滚
    """
    engine = create_async_engine(str(settings.SQLALCHEMY_DATABASE_URI), echo=False)
    async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    
    # 开始一个外部事务
    async with engine.begin() as conn:
        # 在这个事务中创建 session
        session = async_session(bind=conn)
        
        # 开始一个嵌套事务（SAVEPOINT）
        await session.begin_nested()
        
        # 在每次 commit 后自动创建新的 SAVEPOINT
        @event.listens_for(session.sync_session, "after_transaction_end")
        def restart_savepoint(session, transaction):
            if transaction.nested and not transaction._parent.nested:
                session.begin_nested()
        
        yield session
        
        # 测试结束，回滚所有更改
        await session.rollback()
        await session.close()
    
    await engine.dispose()


@pytest.mark.asyncio
class TestDocumentExport:
    """测试文书导出功能"""

    async def test_generate_document_success(self, async_db_session):
        """测试成功生成文书"""
        # 创建测试用户
        user = User(
            name=f"test_user_{int(datetime.now().timestamp())}",
            phone=f"139000{int(datetime.now().timestamp()) % 100000}"
        )
        async_db_session.add(user)
        await async_db_session.commit()
        await async_db_session.refresh(user)
        
        # 创建测试员工
        staff = Staff(
            username=f"test_staff_{int(datetime.now().timestamp())}",
            hashed_password="hashed_password_test"
        )
        async_db_session.add(staff)
        await async_db_session.commit()
        await async_db_session.refresh(staff)

        # 创建测试案件
        case = Case(
            user_id=user.id,
            case_status=CaseStatus.DRAFT,
            description="测试案件"
        )
        async_db_session.add(case)
        await async_db_session.commit()
        await async_db_session.refresh(case)

        template = DocumentTemplate(
            name="测试模板",
            category="test",
            status="published",
            prosemirror_json={
                "type": "doc",
                "content": [
                    {
                        "type": "paragraph",
                        "content": [
                            {"type": "text", "text": "姓名：{{name}}，年龄：{{age}}"}
                        ]
                    }
                ]
            },
            created_by_id=staff.id
        )
        async_db_session.add(template)
        await async_db_session.commit()
        await async_db_session.refresh(template)

        generation = DocumentGeneration(
            case_id=case.id,
            template_id=template.id,
            form_data={"name": "张三", "age": "30"},
            created_by_id=staff.id,
            updated_by_id=staff.id
        )
        async_db_session.add(generation)
        await async_db_session.commit()
        await async_db_session.refresh(generation)

        # Mock COS 上传
        mock_url = "https://test.cos.ap-shanghai.myqcloud.com/documents/test.docx"
        
        # 创建 mock 对象
        mock_cos = Mock()
        mock_template_service = Mock()
        
        with patch("app.document_generation.services.cos_service", mock_cos), \
             patch("app.document_generation.services.template_editor_service", mock_template_service):
            
            # 模拟导出 DOCX
            mock_docx_bytes = b"fake_docx_content"
            mock_template_service.export_prosemirror_to_docx.return_value = {
                "docx": mock_docx_bytes,
                "warnings": []
            }
            
            # 模拟 COS 上传
            mock_cos.upload_file.return_value = mock_url
            
            # 执行导出
            result = await document_generation_service.generate_document(
                db=async_db_session,
                generation_id=generation.id,
                filename="test_document"
            )

        # 验证结果
        assert result["file_url"] == mock_url
        assert result["warnings"] == []
        assert "filename" in result
        
        # 验证占位符替换被调用
        called_json = mock_template_service.export_prosemirror_to_docx.call_args[0][0]
        assert "姓名：张三，年龄：30" in str(called_json)

    async def test_generate_document_not_found(self, async_db_session):
        """测试文书生成记录不存在"""
        with pytest.raises(Exception) as exc_info:
            await document_generation_service.generate_document(
                db=async_db_session,
                generation_id=99999,
                filename="test"
            )
        assert "不存在" in str(exc_info.value.detail)

    async def test_generate_document_with_unfilled_placeholders(self, async_db_session):
        """测试生成文书时包含未填写的占位符"""
        # 创建测试用户
        user = User(
            name=f"test_user2_{int(datetime.now().timestamp())}",
            phone=f"138000{int(datetime.now().timestamp()) % 100000}"
        )
        async_db_session.add(user)
        await async_db_session.commit()
        await async_db_session.refresh(user)
        
        # 创建测试员工
        staff = Staff(
            username=f"test_staff2_{int(datetime.now().timestamp())}",
            hashed_password="hashed_password_test"
        )
        async_db_session.add(staff)
        await async_db_session.commit()
        await async_db_session.refresh(staff)

        # 创建测试案件
        case = Case(
            user_id=user.id,
            case_status=CaseStatus.DRAFT,
            description="测试案件2"
        )
        async_db_session.add(case)
        await async_db_session.commit()
        await async_db_session.refresh(case)

        template = DocumentTemplate(
            name="测试模板2",
            category="test",
            status="published",
            prosemirror_json={
                "type": "doc",
                "content": [
                    {
                        "type": "paragraph",
                        "content": [
                            {"type": "text", "text": "姓名：{{name}}，地址：{{address}}"}
                        ]
                    }
                ]
            },
            created_by_id=staff.id
        )
        async_db_session.add(template)
        await async_db_session.commit()
        await async_db_session.refresh(template)

        # 只填写部分占位符
        generation = DocumentGeneration(
            case_id=case.id,
            template_id=template.id,
            form_data={"name": "李四"},  # 未填写 address
            created_by_id=staff.id,
            updated_by_id=staff.id
        )
        async_db_session.add(generation)
        await async_db_session.commit()
        await async_db_session.refresh(generation)

        # Mock COS 上传
        mock_url = "https://test.cos.ap-shanghai.myqcloud.com/documents/test2.docx"
        
        mock_cos = Mock()
        mock_template_service = Mock()
        
        with patch("app.document_generation.services.cos_service", mock_cos), \
             patch("app.document_generation.services.template_editor_service", mock_template_service):
            
            mock_docx_bytes = b"fake_docx_content_2"
            mock_template_service.export_prosemirror_to_docx.return_value = {
                "docx": mock_docx_bytes,
                "warnings": []
            }
            mock_cos.upload_file.return_value = mock_url
            
            result = await document_generation_service.generate_document(
                db=async_db_session,
                generation_id=generation.id
            )

        # 验证未填写的占位符保留原样
        called_json = mock_template_service.export_prosemirror_to_docx.call_args[0][0]
        assert "姓名：李四" in str(called_json)
        assert "{{address}}" in str(called_json)  # 未填写的占位符保留

    async def test_generate_document_with_custom_filename(self, async_db_session):
        """测试生成文书时指定自定义文件名"""
        # 创建测试用户
        user = User(
            name=f"test_user3_{int(datetime.now().timestamp())}",
            phone=f"137000{int(datetime.now().timestamp()) % 100000}"
        )
        async_db_session.add(user)
        await async_db_session.commit()
        await async_db_session.refresh(user)
        
        # 创建测试员工
        staff = Staff(
            username=f"test_staff3_{int(datetime.now().timestamp())}",
            hashed_password="hashed_password_test"
        )
        async_db_session.add(staff)
        await async_db_session.commit()
        await async_db_session.refresh(staff)

        # 创建测试案件
        case = Case(
            user_id=user.id,
            case_status=CaseStatus.DRAFT,
            description="测试案件3"
        )
        async_db_session.add(case)
        await async_db_session.commit()
        await async_db_session.refresh(case)

        template = DocumentTemplate(
            name="测试模板3",
            category="test",
            status="published",
            prosemirror_json={
                "type": "doc",
                "content": [
                    {
                        "type": "paragraph",
                        "content": [{"type": "text", "text": "测试内容"}]
                    }
                ]
            },
            created_by_id=staff.id
        )
        async_db_session.add(template)
        await async_db_session.commit()
        await async_db_session.refresh(template)

        generation = DocumentGeneration(
            case_id=case.id,
            template_id=template.id,
            form_data={},
            created_by_id=staff.id,
            updated_by_id=staff.id
        )
        async_db_session.add(generation)
        await async_db_session.commit()
        await async_db_session.refresh(generation)

        # Mock COS 上传
        custom_filename = "my_custom_document"
        
        mock_cos = Mock()
        mock_template_service = Mock()
        
        with patch("app.document_generation.services.cos_service", mock_cos), \
             patch("app.document_generation.services.template_editor_service", mock_template_service):
            
            mock_docx_bytes = b"fake_docx_content_3"
            mock_template_service.export_prosemirror_to_docx.return_value = {
                "docx": mock_docx_bytes,
                "warnings": []
            }
            mock_cos.upload_file.return_value = "https://test.cos.ap-shanghai.myqcloud.com/documents/test.docx"
            
            result = await document_generation_service.generate_document(
                db=async_db_session,
                generation_id=generation.id,
                filename=custom_filename
            )

        # 验证文件名被正确使用
        assert custom_filename in result["filename"]
        assert result["filename"].endswith(".docx")

    async def test_generate_document_with_warnings(self, async_db_session):
        """测试生成文书时包含导出警告"""
        # 创建测试用户
        user = User(
            name=f"test_user4_{int(datetime.now().timestamp())}",
            phone=f"136000{int(datetime.now().timestamp()) % 100000}"
        )
        async_db_session.add(user)
        await async_db_session.commit()
        await async_db_session.refresh(user)
        
        # 创建测试员工
        staff = Staff(
            username=f"test_staff4_{int(datetime.now().timestamp())}",
            hashed_password="hashed_password_test"
        )
        async_db_session.add(staff)
        await async_db_session.commit()
        await async_db_session.refresh(staff)

        # 创建测试案件
        case = Case(
            user_id=user.id,
            case_status=CaseStatus.DRAFT,
            description="测试案件4"
        )
        async_db_session.add(case)
        await async_db_session.commit()
        await async_db_session.refresh(case)

        template = DocumentTemplate(
            name="测试模板4",
            category="test",
            status="published",
            prosemirror_json={
                "type": "doc",
                "content": [
                    {
                        "type": "paragraph",
                        "content": [{"type": "text", "text": "测试内容"}]
                    }
                ]
            },
            created_by_id=staff.id
        )
        async_db_session.add(template)
        await async_db_session.commit()
        await async_db_session.refresh(template)

        generation = DocumentGeneration(
            case_id=case.id,
            template_id=template.id,
            form_data={},
            created_by_id=staff.id,
            updated_by_id=staff.id
        )
        async_db_session.add(generation)
        await async_db_session.commit()
        await async_db_session.refresh(generation)

        # Mock COS 上传，模拟导出警告
        test_warnings = ["警告：某些格式可能不兼容", "警告：图片分辨率较低"]
        
        mock_cos = Mock()
        mock_template_service = Mock()
        
        with patch("app.document_generation.services.cos_service", mock_cos), \
             patch("app.document_generation.services.template_editor_service", mock_template_service):
            
            mock_docx_bytes = b"fake_docx_content_4"
            mock_template_service.export_prosemirror_to_docx.return_value = {
                "docx": mock_docx_bytes,
                "warnings": test_warnings
            }
            mock_cos.upload_file.return_value = "https://test.cos.ap-shanghai.myqcloud.com/documents/test.docx"
            
            result = await document_generation_service.generate_document(
                db=async_db_session,
                generation_id=generation.id
            )

        # 验证警告被正确返回
        assert result["warnings"] == test_warnings

