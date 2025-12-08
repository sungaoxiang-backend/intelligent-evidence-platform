"""
文书管理服务
完全独立实现，不依赖现有模板管理和文书生成模块
"""
from typing import Optional, Tuple, List, Dict, Any
from copy import deepcopy
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_

from app.documents_management.models import Document, DocumentDraft
from app.documents_management.schemas import (
    DocumentCreateRequest,
    DocumentUpdateRequest,
)
from app.documents_management.utils import (
    extract_placeholders,
    initialize_placeholder_metadata,
    merge_placeholder_metadata,
    replace_placeholders_in_prosemirror,
)


class DocumentManagementService:
    """文书管理服务类"""
    
    async def create_document(
        self,
        db: AsyncSession,
        request: DocumentCreateRequest,
        staff_id: Optional[int]
    ) -> Document:
        """
        创建文书
        
        Args:
            db: 数据库会话
            request: 创建请求
            staff_id: 创建人ID
            
        Returns:
            创建的文书对象
        """
        # 提取占位符并初始化元数据
        placeholder_names = extract_placeholders(request.content_json)
        placeholder_metadata = initialize_placeholder_metadata(placeholder_names)
        
        document = Document(
            name=request.name,
            description=request.description,
            category=request.category,
            content_json=request.content_json,
            status="draft",  # 默认状态为草稿
            placeholder_metadata=placeholder_metadata,
            created_by_id=staff_id,
            updated_by_id=staff_id,
        )
        
        db.add(document)
        await db.commit()
        await db.refresh(document)
        
        logger.info(f"创建文书成功: {document.id} - {document.name}, 占位符数量: {len(placeholder_names)}")
        return document
    
    async def get_document(
        self,
        db: AsyncSession,
        document_id: int
    ) -> Optional[Document]:
        """
        获取文书详情
        
        Args:
            db: 数据库会话
            document_id: 文书ID
            
        Returns:
            文书对象，如果不存在则返回 None
        """
        result = await db.execute(
            select(Document).where(Document.id == document_id)
        )
        return result.scalar_one_or_none()
    
    async def list_documents(
        self,
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        category: Optional[str] = None,
        status: Optional[str] = None
    ) -> Tuple[List[Document], int]:
        """
        获取文书列表
        
        Args:
            db: 数据库会话
            skip: 跳过记录数
            limit: 返回记录数
            search: 搜索关键词（搜索名称和描述）
            category: 分类过滤
            
        Returns:
            (文书列表, 总数)
        """
        # 构建查询
        query = select(Document)
        
        # 分类过滤
        if category:
            query = query.where(Document.category == category)
        
        # 状态过滤
        if status and status != "all":
            query = query.where(Document.status == status)
        
        # 关键词搜索（搜索名称和描述）
        if search:
            search_filter = or_(
                Document.name.ilike(f"%{search}%"),
                Document.description.ilike(f"%{search}%")
            )
            query = query.where(search_filter)
        
        # 获取总数
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0
        
        # 获取数据（按更新时间倒序）
        query = query.order_by(Document.updated_at.desc())
        query = query.offset(skip).limit(limit)
        
        result = await db.execute(query)
        documents = list(result.scalars().all())
        
        return documents, total
    
    async def update_document(
        self,
        db: AsyncSession,
        document_id: int,
        request: DocumentUpdateRequest,
        staff_id: Optional[int]
    ) -> Optional[Document]:
        """
        更新文书
        
        Args:
            db: 数据库会话
            document_id: 文书ID
            request: 更新请求
            staff_id: 更新人ID
            
        Returns:
            更新后的文书对象，如果不存在则返回 None
        """
        document = await self.get_document(db, document_id)
        if not document:
            return None
        
        # 更新字段
        if request.name is not None:
            document.name = request.name
        if request.description is not None:
            document.description = request.description
        if request.category is not None:
            document.category = request.category
        if request.content_json is not None:
            document.content_json = request.content_json
            # 如果更新了内容，重新提取占位符并合并元数据
            placeholder_names = extract_placeholders(request.content_json)
            existing_metadata = document.placeholder_metadata or {}
            document.placeholder_metadata = merge_placeholder_metadata(
                placeholder_names,
                existing_metadata
            )
        
        document.updated_by_id = staff_id
        
        await db.commit()
        await db.refresh(document)
        
        logger.info(f"更新文书成功: {document.id} - {document.name}")
        return document
    
    async def delete_document(
        self,
        db: AsyncSession,
        document_id: int
    ) -> bool:
        """
        删除文书
        
        Args:
            db: 数据库会话
            document_id: 文书ID
            
        Returns:
            是否删除成功
        """
        document = await self.get_document(db, document_id)
        if not document:
            return False
        
        await db.delete(document)
        await db.commit()
        
        logger.info(f"删除文书成功: {document_id}")
        return True


# 全局服务实例
document_management_service = DocumentManagementService()


class DocumentDraftService:
    """文书草稿管理服务类"""
    
    async def get_draft(
        self,
        db: AsyncSession,
        case_id: int,
        document_id: int
    ) -> Optional[DocumentDraft]:
        """
        获取草稿
        
        Args:
            db: 数据库会话
            case_id: 案件ID
            document_id: 模板ID
            
        Returns:
            草稿对象，如果不存在则返回 None
        """
        result = await db.execute(
            select(DocumentDraft).where(
                DocumentDraft.case_id == case_id,
                DocumentDraft.document_id == document_id
            )
        )
        return result.scalar_one_or_none()
    
    async def create_or_update_draft(
        self,
        db: AsyncSession,
        case_id: int,
        document_id: int,
        form_data: Optional[Dict[str, Any]] = None,
        content_json: Optional[Dict[str, Any]] = None,
        staff_id: Optional[int] = None
    ) -> DocumentDraft:
        """
        创建或更新草稿
        
        Args:
            db: 数据库会话
            case_id: 案件ID
            document_id: 模板ID
            form_data: 表单数据（已废弃，向后兼容）
            content_json: ProseMirror JSON 格式的文档内容
            staff_id: 操作人ID
            
        Returns:
            创建或更新后的草稿对象
        """
        # 查询是否已存在
        existing_draft = await self.get_draft(db, case_id, document_id)
        
        if existing_draft:
            # 更新现有草稿
            if content_json is not None:
                existing_draft.content_json = deepcopy(content_json)
            elif form_data is not None:
                # 向后兼容：如果只提供了 form_data，保持原有逻辑
                existing_draft.form_data = form_data
            existing_draft.updated_by_id = staff_id
            await db.commit()
            await db.refresh(existing_draft)
            logger.info(f"更新草稿成功: {existing_draft.id} - case_id={case_id}, document_id={document_id}")
            return existing_draft
        else:
            # 创建新草稿
            # 如果未提供 content_json，从模板深拷贝
            if content_json is None:
                # 获取模板
                document_service = DocumentManagementService()
                template = await document_service.get_document(db, document_id)
                if template:
                    content_json = deepcopy(template.content_json)
                else:
                    # 如果模板不存在，使用空内容
                    content_json = {"type": "doc", "content": []}
            
            # 向后兼容：如果提供了 form_data，也保存它
            if form_data is None:
                form_data = {}
            
            draft = DocumentDraft(
                case_id=case_id,
                document_id=document_id,
                form_data=form_data,
                content_json=content_json,
                created_by_id=staff_id,
                updated_by_id=staff_id,
            )
            db.add(draft)
            await db.commit()
            await db.refresh(draft)
            logger.info(f"创建草稿成功: {draft.id} - case_id={case_id}, document_id={document_id}")
            return draft
    
    async def delete_draft(
        self,
        db: AsyncSession,
        draft_id: int
    ) -> bool:
        """
        删除草稿
        
        Args:
            db: 数据库会话
            draft_id: 草稿ID
            
        Returns:
            是否删除成功
        """
        result = await db.execute(
            select(DocumentDraft).where(DocumentDraft.id == draft_id)
        )
        draft = result.scalar_one_or_none()
        if not draft:
            return False
        
        await db.delete(draft)
        await db.commit()
        
        logger.info(f"删除草稿成功: {draft_id}")
        return True
    
    async def list_drafts_by_case(
        self,
        db: AsyncSession,
        case_id: int
    ) -> List[DocumentDraft]:
        """
        获取某个案件的所有草稿
        
        Args:
            db: 数据库会话
            case_id: 案件ID
            
        Returns:
            草稿列表
        """
        result = await db.execute(
            select(DocumentDraft).where(DocumentDraft.case_id == case_id)
            .order_by(DocumentDraft.updated_at.desc())
        )
        return list(result.scalars().all())
    
    async def generate_document(
        self,
        db: AsyncSession,
        case_id: int,
        document_id: int,
        form_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        生成填充后的文档
        
        Args:
            db: 数据库会话
            case_id: 案件ID
            document_id: 模板ID
            form_data: 表单数据
            
        Returns:
            填充后的文档内容（ProseMirror JSON格式）
        """
        # 获取模板
        document = await document_management_service.get_document(db, document_id)
        if not document:
            raise ValueError(f"模板不存在: {document_id}")
        
        # 替换占位符
        filled_content = replace_placeholders_in_prosemirror(
            document.content_json,
            form_data,
            document.placeholder_metadata
        )
        
        logger.info(f"生成文档成功: case_id={case_id}, document_id={document_id}")
        return filled_content


# 全局服务实例
document_draft_service = DocumentDraftService()

