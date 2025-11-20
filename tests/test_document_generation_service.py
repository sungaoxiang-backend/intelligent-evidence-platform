"""
文书生成服务测试
"""
import pytest
import pytest_asyncio
from datetime import datetime
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select, event

from app.core.config import settings
from app.db.base import Base
from app.document_generation.models import DocumentGeneration
from app.document_generation.services import document_generation_service
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


# Fixtures removed - using inline test data creation instead


@pytest.mark.asyncio
class TestGetPublishedTemplates:
    """测试获取已发布模板列表"""
    
    async def test_get_published_templates_only(self, async_db_session: AsyncSession):
        """测试只返回已发布的模板"""
        # 创建测试模板
        published_template = DocumentTemplate(
            name="测试已发布模板",
            status="published",
            prosemirror_json={"type": "doc", "content": []}
        )
        draft_template = DocumentTemplate(
            name="测试草稿模板",
            status="draft",
            prosemirror_json={"type": "doc", "content": []}
        )
        async_db_session.add_all([published_template, draft_template])
        await async_db_session.commit()
        
        # 调用服务
        templates, total = await document_generation_service.get_published_templates(
            db=async_db_session,
            skip=0,
            limit=10
        )
        
        # 应该只返回已发布的模板
        template_names = [t.name for t in templates]
        assert published_template.name in template_names
        assert draft_template.name not in template_names
        assert total >= 1
        
        # 清理
        await async_db_session.delete(published_template)
        await async_db_session.delete(draft_template)
        await async_db_session.commit()
    
    async def test_get_published_templates_with_pagination(self, async_db_session: AsyncSession):
        """测试分页功能"""
        # 创建多个已发布模板
        created_templates = []
        for i in range(4):
            template = DocumentTemplate(
                name=f"分页测试模板{i}",
                status="published",
                prosemirror_json={"type": "doc", "content": []}
            )
            async_db_session.add(template)
            created_templates.append(template)
        await async_db_session.commit()
        
        # 测试分页
        templates, total = await document_generation_service.get_published_templates(
            db=async_db_session,
            skip=0,
            limit=2
        )
        
        assert len(templates) <= 2  # 应该返回最多 2 条
        assert total >= 4  # 至少有 4 个已发布模板
        
        # 清理
        for template in created_templates:
            await async_db_session.delete(template)
        await async_db_session.commit()
    
    async def test_get_published_templates_with_category_filter(self, async_db_session: AsyncSession):
        """测试按分类过滤"""
        # 创建不同分类的模板
        template1 = DocumentTemplate(
            name="分类测试民事模板",
            category="民事诉讼",
            status="published",
            prosemirror_json={"type": "doc", "content": []}
        )
        template2 = DocumentTemplate(
            name="分类测试刑事模板",
            category="刑事诉讼",
            status="published",
            prosemirror_json={"type": "doc", "content": []}
        )
        async_db_session.add_all([template1, template2])
        await async_db_session.commit()
        
        # 按分类过滤
        templates, total = await document_generation_service.get_published_templates(
            db=async_db_session,
            skip=0,
            limit=10,
            category="民事诉讼"
        )
        
        # 所有返回的模板都应该是民事诉讼分类
        for template in templates:
            if template.category:
                assert template.category == "民事诉讼"
        
        # 清理
        await async_db_session.delete(template1)
        await async_db_session.delete(template2)
        await async_db_session.commit()
    
    async def test_get_published_templates_with_search(self, async_db_session: AsyncSession):
        """测试关键词搜索"""
        # 创建带特定名称的模板
        template = DocumentTemplate(
            name="搜索测试买卖合同纠纷起诉状",
            status="published",
            prosemirror_json={"type": "doc", "content": []}
        )
        async_db_session.add(template)
        await async_db_session.commit()
        
        # 搜索
        templates, total = await document_generation_service.get_published_templates(
            db=async_db_session,
            skip=0,
            limit=10,
            search="搜索测试买卖"
        )
        
        # 应该找到包含关键词的模板
        template_names = [t.name for t in templates]
        assert any("搜索测试买卖" in name for name in template_names)
        
        # 清理
        await async_db_session.delete(template)
        await async_db_session.commit()


@pytest.mark.asyncio
class TestGetGenerationDetail:
    """测试获取文书生成记录详情"""
    
    async def test_get_generation_detail_success(self, async_db_session: AsyncSession):
        """测试成功获取文书生成记录详情"""
        #  查找现有数据或创建简单测试数据
        import time
        
        # 查找或创建用户
        result = await async_db_session.execute(select(User).limit(1))
        user = result.scalar_one_or_none()
        if not user:
            unique_phone = f"138{int(time.time() * 1000) % 100000000:08d}"
            user = User(name="详情测试用户", phone=unique_phone)
            async_db_session.add(user)
            await async_db_session.commit()
            await async_db_session.refresh(user)
        
        # 创建测试案件
        case = Case(
            user_id=user.id,
            case_status=CaseStatus.DRAFT,
            description="详情测试案件"
        )
        async_db_session.add(case)
        await async_db_session.commit()
        await async_db_session.refresh(case)
        
        # 查找已发布的模板
        result = await async_db_session.execute(
            select(DocumentTemplate).where(DocumentTemplate.status == 'published').limit(1)
        )
        template = result.scalar_one_or_none()
        if not template:
            template = DocumentTemplate(
                name="详情测试模板",
                status="published",
                prosemirror_json={"type": "doc", "content": []}
            )
            async_db_session.add(template)
            await async_db_session.commit()
            await async_db_session.refresh(template)
        
        # 创建文书生成记录
        generation = DocumentGeneration(
            case_id=case.id,
            template_id=template.id,
            form_data={"test": "测试值"}
        )
        async_db_session.add(generation)
        await async_db_session.commit()
        await async_db_session.refresh(generation)
        
        # 获取详情
        result = await document_generation_service.get_generation_detail(
            db=async_db_session,
            generation_id=generation.id
        )
        
        assert result is not None
        assert result.id == generation.id
        assert result.case_id == case.id
        assert result.template_id == template.id
        
        # 验证关联数据已加载
        assert result.case is not None
        assert result.case.id == case.id
        assert result.template is not None
        assert result.template.id == template.id
        
        # 清理
        await async_db_session.delete(generation)
        await async_db_session.delete(case)
        await async_db_session.commit()
    
    async def test_get_generation_detail_not_found(self, async_db_session: AsyncSession):
        """测试获取不存在的记录"""
        result = await document_generation_service.get_generation_detail(
            db=async_db_session,
            generation_id=999999
        )
        
        assert result is None


@pytest.mark.asyncio
class TestCreateOrGetGeneration:
    """测试创建或获取文书生成记录"""
    
    async def test_create_new_generation(self, async_db_session: AsyncSession):
        """测试创建新的文书生成记录"""
        import time
        
        # 准备测试数据
        unique_phone = f"138{int(time.time() * 1000) % 100000000:08d}"
        user = User(name="创建测试用户", phone=unique_phone)
        async_db_session.add(user)
        await async_db_session.commit()
        await async_db_session.refresh(user)
        
        case = Case(user_id=user.id, case_status=CaseStatus.DRAFT)
        async_db_session.add(case)
        await async_db_session.commit()
        await async_db_session.refresh(case)
        
        # 查找已发布模板
        result = await async_db_session.execute(
            select(DocumentTemplate).where(DocumentTemplate.status == 'published').limit(1)
        )
        template = result.scalar_one_or_none()
        if not template:
            template = DocumentTemplate(
                name="创建测试模板",
                status="published",
                prosemirror_json={"type": "doc", "content": []}
            )
            async_db_session.add(template)
            await async_db_session.commit()
            await async_db_session.refresh(template)
        
        # 查找员工
        result = await async_db_session.execute(select(Staff).limit(1))
        staff = result.scalar_one_or_none()
        if not staff:
            staff = Staff(username="teststaff1", hashed_password="test", full_name="测试员工")
            async_db_session.add(staff)
            await async_db_session.commit()
            await async_db_session.refresh(staff)
        
        # 创建文书生成记录
        generation = await document_generation_service.create_or_get_generation(
            db=async_db_session,
            case_id=case.id,
            template_id=template.id,
            staff_id=staff.id
        )
        
        assert generation is not None
        assert generation.id is not None
        assert generation.case_id == case.id
        assert generation.template_id == template.id
        assert generation.form_data == {}
        assert generation.created_by_id == staff.id
        assert generation.updated_by_id == staff.id
        
        # 清理
        await async_db_session.delete(generation)
        await async_db_session.delete(case)
        await async_db_session.commit()
    
    async def test_get_existing_generation(self, async_db_session: AsyncSession):
        """测试获取已存在的文书生成记录（不创建新的）"""
        import time
        
        # 准备测试数据
        unique_phone = f"138{int(time.time() * 1000) % 100000000:08d}"
        user = User(name="获取测试用户", phone=unique_phone)
        async_db_session.add(user)
        await async_db_session.commit()
        
        case = Case(user_id=user.id, case_status=CaseStatus.DRAFT)
        async_db_session.add(case)
        await async_db_session.commit()
        await async_db_session.refresh(case)
        
        result = await async_db_session.execute(
            select(DocumentTemplate).where(DocumentTemplate.status == 'published').limit(1)
        )
        template = result.scalar_one()
        
        result = await async_db_session.execute(select(Staff).limit(1))
        staff = result.scalar_one()
        
        # 第一次调用：创建记录
        generation1 = await document_generation_service.create_or_get_generation(
            db=async_db_session,
            case_id=case.id,
            template_id=template.id,
            staff_id=staff.id
        )
        
        # 更新一些数据
        generation1.form_data = {"test": "value"}
        await async_db_session.commit()
        
        # 第二次调用：应该返回相同的记录
        generation2 = await document_generation_service.create_or_get_generation(
            db=async_db_session,
            case_id=case.id,
            template_id=template.id,
            staff_id=staff.id
        )
        
        assert generation2.id == generation1.id
        assert generation2.form_data == {"test": "value"}  # 数据应该保留
        
        # 清理
        await async_db_session.delete(generation1)
        await async_db_session.delete(case)
        await async_db_session.commit()
    
    async def test_case_not_found(self, async_db_session: AsyncSession):
        """测试案件不存在时抛出异常"""
        from fastapi import HTTPException
        
        result = await async_db_session.execute(select(Staff).limit(1))
        staff = result.scalar_one()
        
        with pytest.raises(HTTPException) as exc_info:
            await document_generation_service.create_or_get_generation(
                db=async_db_session,
                case_id=999999,
                template_id=1,
                staff_id=staff.id
            )
        
        assert exc_info.value.status_code == 404
        assert "案件不存在" in str(exc_info.value.detail)
    
    async def test_template_not_found(self, async_db_session: AsyncSession):
        """测试模板不存在时抛出异常"""
        from fastapi import HTTPException
        import time
        
        # 创建案件
        unique_phone = f"138{int(time.time() * 1000) % 100000000:08d}"
        user = User(name="模板测试用户", phone=unique_phone)
        async_db_session.add(user)
        await async_db_session.commit()
        
        case = Case(user_id=user.id, case_status=CaseStatus.DRAFT)
        async_db_session.add(case)
        await async_db_session.commit()
        await async_db_session.refresh(case)
        
        result = await async_db_session.execute(select(Staff).limit(1))
        staff = result.scalar_one()
        
        with pytest.raises(HTTPException) as exc_info:
            await document_generation_service.create_or_get_generation(
                db=async_db_session,
                case_id=case.id,
                template_id=999999,
                staff_id=staff.id
            )
        
        assert exc_info.value.status_code == 404
        assert "模板不存在" in str(exc_info.value.detail)
        
        # 清理
        await async_db_session.delete(case)
        await async_db_session.commit()
    
    async def test_template_not_published(self, async_db_session: AsyncSession):
        """测试模板未发布时抛出异常"""
        from fastapi import HTTPException
        import time
        
        # 创建草稿模板
        draft_template = DocumentTemplate(
            name="未发布模板测试",
            status="draft",
            prosemirror_json={"type": "doc", "content": []}
        )
        async_db_session.add(draft_template)
        await async_db_session.commit()
        await async_db_session.refresh(draft_template)
        
        unique_phone = f"138{int(time.time() * 1000) % 100000000:08d}"
        user = User(name="发布测试用户", phone=unique_phone)
        async_db_session.add(user)
        await async_db_session.commit()
        
        case = Case(user_id=user.id, case_status=CaseStatus.DRAFT)
        async_db_session.add(case)
        await async_db_session.commit()
        await async_db_session.refresh(case)
        
        result = await async_db_session.execute(select(Staff).limit(1))
        staff = result.scalar_one()
        
        with pytest.raises(HTTPException) as exc_info:
            await document_generation_service.create_or_get_generation(
                db=async_db_session,
                case_id=case.id,
                template_id=draft_template.id,
                staff_id=staff.id
            )
        
        assert exc_info.value.status_code == 400
        assert "模板未发布" in str(exc_info.value.detail)
        
        # 清理
        await async_db_session.delete(draft_template)
        await async_db_session.delete(case)
        await async_db_session.commit()


@pytest.mark.asyncio
class TestUpdateGenerationData:
    """测试更新文书生成草稿数据"""
    
    async def test_update_generation_data(self, async_db_session: AsyncSession):
        """测试更新文书生成的表单数据"""
        import time
        
        # 准备测试数据
        unique_phone = f"138{int(time.time() * 1000) % 100000000:08d}"
        user = User(name="更新测试用户", phone=unique_phone)
        async_db_session.add(user)
        await async_db_session.commit()
        
        case = Case(user_id=user.id, case_status=CaseStatus.DRAFT)
        async_db_session.add(case)
        await async_db_session.commit()
        await async_db_session.refresh(case)
        
        result = await async_db_session.execute(
            select(DocumentTemplate).where(DocumentTemplate.status == 'published').limit(1)
        )
        template = result.scalar_one()
        
        result = await async_db_session.execute(select(Staff).limit(1))
        staff = result.scalar_one()
        
        # 创建文书生成记录
        generation = DocumentGeneration(
            case_id=case.id,
            template_id=template.id,
            form_data={"name": "旧值"}
        )
        async_db_session.add(generation)
        await async_db_session.commit()
        await async_db_session.refresh(generation)
        
        # 更新数据
        new_form_data = {"name": "新值", "amount": 10000}
        updated_generation = await document_generation_service.update_generation_data(
            db=async_db_session,
            generation_id=generation.id,
            form_data=new_form_data,
            staff_id=staff.id
        )
        
        assert updated_generation.id == generation.id
        assert updated_generation.form_data == new_form_data
        assert updated_generation.updated_by_id == staff.id
        assert updated_generation.updated_at > generation.created_at
        
        # 清理
        await async_db_session.delete(generation)
        await async_db_session.delete(case)
        await async_db_session.commit()
    
    async def test_update_nonexistent_generation(self, async_db_session: AsyncSession):
        """测试更新不存在的记录时抛出异常"""
        from fastapi import HTTPException
        
        result = await async_db_session.execute(select(Staff).limit(1))
        staff = result.scalar_one()
        
        with pytest.raises(HTTPException) as exc_info:
            await document_generation_service.update_generation_data(
                db=async_db_session,
                generation_id=999999,
                form_data={"test": "value"},
                staff_id=staff.id
            )
        
        assert exc_info.value.status_code == 404
        assert "文书生成记录不存在" in str(exc_info.value.detail)


@pytest.mark.asyncio
class TestGenerateDocument:
    """测试文书生成和导出功能"""
    
    async def test_generate_document_success(self, async_db_session: AsyncSession):
        """测试成功生成文书"""
        import time
        from unittest.mock import patch, MagicMock
        
        # 准备测试数据
        unique_phone = f"138{int(time.time() * 1000) % 100000000:08d}"
        user = User(name="导出测试用户", phone=unique_phone)
        async_db_session.add(user)
        await async_db_session.commit()
        
        case = Case(user_id=user.id, case_status=CaseStatus.DRAFT)
        async_db_session.add(case)
        await async_db_session.commit()
        await async_db_session.refresh(case)
        
        # 查找已发布模板
        result = await async_db_session.execute(
            select(DocumentTemplate).where(DocumentTemplate.status == 'published').limit(1)
        )
        template = result.scalar_one()
        
        # 创建文书生成记录
        generation = DocumentGeneration(
            case_id=case.id,
            template_id=template.id,
            form_data={"plaintiff": "张三", "defendant": "李四"}
        )
        async_db_session.add(generation)
        await async_db_session.commit()
        await async_db_session.refresh(generation)
        
        # Mock COS 上传服务
        with patch('app.document_generation.services.get_cos_service') as mock_get_cos:
            mock_cos = MagicMock()
            mock_cos.upload_file = MagicMock(return_value="https://example.com/test.docx")
            mock_get_cos.return_value = mock_cos
            
            # Mock template_editor_service 的导出功能
            with patch('app.document_generation.services.template_editor_service') as mock_editor:
                mock_editor.export_prosemirror_to_docx = MagicMock(return_value={
                    "docx": b'fake docx content',
                    "warnings": []
                })
                
                # 生成文书
                result = await document_generation_service.generate_document(
                    db=async_db_session,
                    generation_id=generation.id
                )
                
                # 验证返回的 URL
                assert result["file_url"] == "https://example.com/test.docx"
                assert "filename" in result
                assert result["warnings"] == []
                
                # 验证调用了导出功能
                mock_editor.export_prosemirror_to_docx.assert_called_once()
                
                # 验证调用了 COS 上传
                mock_cos.upload_file.assert_called_once()
        
        # 清理
        await async_db_session.delete(generation)
        await async_db_session.delete(case)
        await async_db_session.commit()
    
    async def test_generate_document_with_custom_filename(self, async_db_session: AsyncSession):
        """测试使用自定义文件名生成文书"""
        import time
        from unittest.mock import patch, MagicMock
        
        # 准备测试数据
        unique_phone = f"138{int(time.time() * 1000) % 100000000:08d}"
        user = User(name="文件名测试用户", phone=unique_phone)
        async_db_session.add(user)
        await async_db_session.commit()
        
        case = Case(user_id=user.id, case_status=CaseStatus.DRAFT)
        async_db_session.add(case)
        await async_db_session.commit()
        await async_db_session.refresh(case)
        
        result = await async_db_session.execute(
            select(DocumentTemplate).where(DocumentTemplate.status == 'published').limit(1)
        )
        template = result.scalar_one()
        
        generation = DocumentGeneration(
            case_id=case.id,
            template_id=template.id,
            form_data={}
        )
        async_db_session.add(generation)
        await async_db_session.commit()
        await async_db_session.refresh(generation)
        
        with patch('app.document_generation.services.get_cos_service') as mock_get_cos:
            mock_cos = MagicMock()
            mock_cos.upload_file = MagicMock(return_value="https://example.com/custom.docx")
            mock_get_cos.return_value = mock_cos
            
            with patch('app.document_generation.services.template_editor_service') as mock_editor:
                mock_editor.export_prosemirror_to_docx = MagicMock(return_value={
                    "docx": b'fake docx',
                    "warnings": []
                })
                
                # 使用自定义文件名
                result = await document_generation_service.generate_document(
                    db=async_db_session,
                    generation_id=generation.id,
                    filename="自定义文件名.docx"
                )
                
                assert result["file_url"] == "https://example.com/custom.docx"
                assert result["filename"] == "自定义文件名.docx"
                assert result["warnings"] == []
        
        # 清理
        await async_db_session.delete(generation)
        await async_db_session.delete(case)
        await async_db_session.commit()
    
    async def test_generate_document_replaces_placeholders(self, async_db_session: AsyncSession):
        """测试生成文书时占位符被正确替换"""
        import time
        from unittest.mock import patch, MagicMock
        
        # 准备测试数据
        unique_phone = f"138{int(time.time() * 1000) % 100000000:08d}"
        user = User(name="占位符测试用户", phone=unique_phone)
        async_db_session.add(user)
        await async_db_session.commit()
        
        case = Case(user_id=user.id, case_status=CaseStatus.DRAFT)
        async_db_session.add(case)
        await async_db_session.commit()
        await async_db_session.refresh(case)
        
        # 创建包含占位符的模板
        template = DocumentTemplate(
            name="占位符测试模板",
            status="published",
            prosemirror_json={
                "type": "doc",
                "content": [
                    {
                        "type": "paragraph",
                        "content": [
                            {"type": "text", "text": "原告：{{plaintiff}}，被告：{{defendant}}"}
                        ]
                    }
                ]
            }
        )
        async_db_session.add(template)
        await async_db_session.commit()
        await async_db_session.refresh(template)
        
        generation = DocumentGeneration(
            case_id=case.id,
            template_id=template.id,
            form_data={"plaintiff": "张三", "defendant": "李四"}
        )
        async_db_session.add(generation)
        await async_db_session.commit()
        await async_db_session.refresh(generation)
        
        with patch('app.document_generation.services.get_cos_service') as mock_get_cos:
            mock_cos = MagicMock()
            mock_cos.upload_file = MagicMock(return_value="https://example.com/test.docx")
            mock_get_cos.return_value = mock_cos
            
            with patch('app.document_generation.services.template_editor_service') as mock_editor:
                mock_editor.export_prosemirror_to_docx = MagicMock(return_value={
                    "docx": b'fake docx',
                    "warnings": []
                })
                
                await document_generation_service.generate_document(
                    db=async_db_session,
                    generation_id=generation.id
                )
                
                # 获取传递给导出函数的 JSON
                call_args = mock_editor.export_prosemirror_to_docx.call_args
                exported_json = call_args[0][0]
                
                # 验证占位符已被替换
                text = exported_json["content"][0]["content"][0]["text"]
                assert "张三" in text
                assert "李四" in text
                assert "{{plaintiff}}" not in text
                assert "{{defendant}}" not in text
        
        # 清理
        await async_db_session.delete(generation)
        await async_db_session.delete(template)
        await async_db_session.delete(case)
        await async_db_session.commit()
    
    async def test_generate_document_not_found(self, async_db_session: AsyncSession):
        """测试生成不存在的文书记录时抛出异常"""
        from fastapi import HTTPException
        
        with pytest.raises(HTTPException) as exc_info:
            await document_generation_service.generate_document(
                db=async_db_session,
                generation_id=999999
            )
        
        assert exc_info.value.status_code == 404
        assert "文书生成记录不存在" in str(exc_info.value.detail)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

