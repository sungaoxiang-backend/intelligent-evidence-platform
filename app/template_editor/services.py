"""
模板编辑器服务
提供 docx 解析和导出功能
"""

import io
import re
from typing import Dict, Any, List, Set, Optional
from docx import Document
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from .mappers import DocxToProseMirrorMapper, ProseMirrorToDocxMapper
from .models import DocumentTemplate, TemplatePlaceholder


class TemplateEditorService:
    """模板编辑器服务"""

    def __init__(self):
        self.docx_to_pm_mapper = DocxToProseMirrorMapper()
        self.pm_to_docx_mapper = ProseMirrorToDocxMapper()
    
    def extract_placeholders(self, prosemirror_json: Dict[str, Any]) -> Dict[str, Any]:
        """
        从 ProseMirror JSON 中提取占位符（{{name}} 格式）
        
        Args:
            prosemirror_json: ProseMirror JSON 格式的文档
            
        Returns:
            占位符信息字典，格式：
            {
                'placeholders': ['name', 'date', 'address'],  # 去重后的占位符名称列表
                'metadata': {
                    'name': {'count': 3, 'positions': [...]},  # 每个占位符的元数据
                    ...
                }
            }
        """
        placeholders_set: Set[str] = set()
        placeholder_metadata: Dict[str, Dict[str, Any]] = {}
        
        def traverse_node(node: Dict[str, Any], path: List[str] = []):
            """递归遍历 ProseMirror 节点树"""
            node_type = node.get("type")
            
            # 如果是文本节点，检查文本内容
            if node_type == "text":
                text = node.get("text", "")
                # 使用正则表达式提取 {{placeholder}} 格式的占位符
                pattern = r'\{\{([^}]+)\}\}'
                matches = re.finditer(pattern, text)
                
                for match in matches:
                    placeholder_name = match.group(1).strip()
                    if placeholder_name:
                        placeholders_set.add(placeholder_name)
                        
                        # 记录占位符的元数据
                        if placeholder_name not in placeholder_metadata:
                            placeholder_metadata[placeholder_name] = {
                                'count': 0,
                                'positions': []
                            }
                        
                        placeholder_metadata[placeholder_name]['count'] += 1
                        placeholder_metadata[placeholder_name]['positions'].append({
                            'path': path.copy(),
                            'text': text,
                            'start': match.start(),
                            'end': match.end()
                        })
            
            # 递归处理子节点
            content = node.get("content", [])
            if isinstance(content, list):
                for idx, child in enumerate(content):
                    child_path = path + [f"{node_type}[{idx}]"]
                    traverse_node(child, child_path)
        
        # 从根节点开始遍历
        traverse_node(prosemirror_json)
        
        # 返回结果
        return {
            'placeholders': sorted(list(placeholders_set)),
            'metadata': placeholder_metadata
        }

    def parse_docx_to_prosemirror(self, docx_bytes: bytes) -> Dict[str, Any]:
        """
        解析 docx 文件为 ProseMirror JSON 格式

        Args:
            docx_bytes: docx 文件的字节流

        Returns:
            ProseMirror JSON 格式的文档

        Raises:
            ValueError: 如果文件格式无效
        """
        try:
            # 从字节流创建 Document 对象
            doc = Document(io.BytesIO(docx_bytes))

            # 使用映射器转换为 ProseMirror JSON
            prosemirror_json = self.docx_to_pm_mapper.map_document(doc)

            # 记录解析结果（用于调试）
            content_count = len(prosemirror_json.get("content", []))
            logger.info(f"解析 docx 成功，共 {content_count} 个元素")
            if content_count > 0:
                first_element = prosemirror_json["content"][0]
                logger.info(f"第一个元素类型: {first_element.get('type')}")

            return prosemirror_json

        except Exception as e:
            logger.error(f"解析 docx 文件失败: {str(e)}")
            raise ValueError(f"无法解析 docx 文件: {str(e)}") from e

    def export_prosemirror_to_docx(
        self, prosemirror_json: Dict[str, Any]
    ) -> bytes:
        """
        从 ProseMirror JSON 导出为 docx 文件

        Args:
            prosemirror_json: ProseMirror JSON 格式的文档

        Returns:
            docx 文件的字节流

        Raises:
            ValueError: 如果 JSON 格式无效
        """
        try:
            # 验证 JSON 格式
            if not isinstance(prosemirror_json, dict):
                raise ValueError("ProseMirror JSON 必须是字典类型")

            if prosemirror_json.get("type") != "doc":
                raise ValueError(
                    "ProseMirror JSON 的根节点类型必须是 'doc'"
                )

            # 使用映射器转换为 docx
            logger.info("开始转换 ProseMirror JSON 到 DOCX")
            doc = self.pm_to_docx_mapper.map_document(prosemirror_json)
            logger.info("DOCX 文档创建成功")
            
            # 验证表格列宽（在保存前）
            if doc.tables:
                from docx.oxml.ns import qn
                ns = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
                for table_idx, table in enumerate(doc.tables):
                    tbl = table._tbl
                    tbl_grid = tbl.tblGrid
                    if tbl_grid is not None:
                        grid_cols = tbl_grid.findall(f'.//{ns}gridCol')
                        logger.info(f"[SERVICE] 保存前验证 - 表格{table_idx} tblGrid 列宽:")
                        for i, grid_col in enumerate(grid_cols):
                            width = grid_col.get(qn('w:w'))
                            width_type = grid_col.get(qn('w:type'))
                            logger.info(f"[SERVICE]   列 {i}: width={width}, type={width_type}")

            # 保存到字节流
            logger.info("开始保存 DOCX 到字节流")
            output = io.BytesIO()
            doc.save(output)
            logger.info("DOCX 保存到字节流成功")
            output.seek(0)
            docx_bytes = output.getvalue()
            logger.info(f"DOCX 字节流大小: {len(docx_bytes)} bytes")
            
            # 验证保存后的列宽（重新读取）
            from docx import Document
            doc_verify = Document(io.BytesIO(docx_bytes))
            if doc_verify.tables:
                from docx.oxml.ns import qn
                ns = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
                for table_idx, table in enumerate(doc_verify.tables):
                    tbl = table._tbl
                    tbl_grid = tbl.tblGrid
                    if tbl_grid is not None:
                        grid_cols = tbl_grid.findall(f'.//{ns}gridCol')
                        logger.info(f"[SERVICE] 保存后验证 - 表格{table_idx} tblGrid 列宽:")
                        for i, grid_col in enumerate(grid_cols):
                            width = grid_col.get(qn('w:w'))
                            width_type = grid_col.get(qn('w:type'))
                            logger.info(f"[SERVICE]   列 {i}: width={width}, type={width_type}")
            
            return docx_bytes

        except UnicodeEncodeError as e:
            logger.error(f"编码错误 - 位置: {e.start}-{e.end}, 对象: {e.object}, 错误: {str(e)}")
            raise ValueError(f"无法导出 docx 文件: 编码错误 - {str(e)}") from e
        except Exception as e:
            logger.error(f"导出 docx 文件失败: {str(e)}", exc_info=True)
            raise ValueError(f"无法导出 docx 文件: {str(e)}") from e


class TemplateService:
    """模板管理服务"""
    
    async def create_template(
        self,
        db: AsyncSession,
        name: str,
        prosemirror_json: Dict[str, Any],
        docx_url: Optional[str] = None,
        description: Optional[str] = None,
        category: Optional[str] = None,
        status: str = "draft",
        created_by_id: Optional[int] = None,
    ) -> DocumentTemplate:
        """
        创建文书模板
        
        Args:
            db: 数据库会话
            name: 模板名称
            prosemirror_json: ProseMirror JSON 内容
            docx_url: DOCX 文件在 COS 中的 URL
            description: 模板描述
            category: 分类名称
            status: 状态（draft/published）
            created_by_id: 创建人ID
            
        Returns:
            创建的模板对象
        """
        # 提取占位符
        placeholder_info = template_editor_service.extract_placeholders(prosemirror_json)
        placeholder_names = placeholder_info.get('placeholders', [])
        
        # 创建模板对象
        template = DocumentTemplate(
            name=name,
            description=description,
            category=category,
            status=status,
            prosemirror_json=prosemirror_json,
            docx_url=docx_url,
            created_by_id=created_by_id,
            updated_by_id=created_by_id,
        )
        
        db.add(template)
        await db.flush()  # 先 flush 以获取 template.id
        
        # 为每个占位符名称创建或获取 TemplatePlaceholder 对象并关联到模板
        placeholder_objects = []
        for placeholder_name in placeholder_names:
            # 查询是否已存在
            result = await db.execute(
                select(TemplatePlaceholder).where(
                    TemplatePlaceholder.placeholder_name == placeholder_name
                )
            )
            placeholder = result.scalar_one_or_none()
            
            if not placeholder:
                # 创建新占位符（只设置 placeholder_name，其他用默认值）
                placeholder = TemplatePlaceholder(
                    placeholder_name=placeholder_name,
                    type="text",  # 默认类型
                    required=False,  # 默认值
                    hint=None,  # 默认值
                    options=None,  # 默认值
                    created_by_id=created_by_id,
                    updated_by_id=created_by_id,
                )
                db.add(placeholder)
                await db.flush()  # flush 以获取 placeholder.id
                logger.info(f"创建占位符: {placeholder_name}")
            else:
                logger.info(f"使用已存在的占位符: {placeholder_name}")
            
            placeholder_objects.append(placeholder)
        
        # 关联占位符到模板（直接操作中间表，避免触发懒加载）
        if placeholder_objects:
            from .models import template_placeholder_association
            # 直接插入到中间表，避免访问关系字段触发懒加载
            for placeholder in placeholder_objects:
                await db.execute(
                    template_placeholder_association.insert().values(
                        template_id=template.id,
                        placeholder_id=placeholder.id
                    )
                )
        
        await db.commit()
        await db.refresh(template)
        
        logger.info(f"创建模板成功: {template.id}, 名称: {name}, 占位符数量: {len(placeholder_names)}")
        
        return template
    
    async def get_template(self, db: AsyncSession, template_id: int) -> Optional[DocumentTemplate]:
        """根据ID获取文书模板"""
        result = await db.execute(
            select(DocumentTemplate)
            .where(DocumentTemplate.id == template_id)
            .options(selectinload(DocumentTemplate.placeholders))
        )
        return result.scalar_one_or_none()
    
    async def list_templates(
        self,
        db: AsyncSession,
        status: Optional[str] = None,
        category: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[DocumentTemplate]:
        """列出文书模板"""
        query = select(DocumentTemplate).options(selectinload(DocumentTemplate.placeholders))
        
        if status:
            query = query.where(DocumentTemplate.status == status)
        if category:
            query = query.where(DocumentTemplate.category == category)
        
        query = query.offset(skip).limit(limit).order_by(DocumentTemplate.created_at.desc())
        
        result = await db.execute(query)
        return list(result.scalars().unique().all())
    
    async def update_template(
        self,
        db: AsyncSession,
        template: DocumentTemplate,
        name: Optional[str] = None,
        prosemirror_json: Optional[Dict[str, Any]] = None,
        docx_url: Optional[str] = None,
        description: Optional[str] = None,
        category: Optional[str] = None,
        status: Optional[str] = None,
        updated_by_id: Optional[int] = None,
    ) -> DocumentTemplate:
        """更新文书模板"""
        if name is not None:
            template.name = name
        if description is not None:
            template.description = description
        if category is not None:
            template.category = category
        if status is not None:
            template.status = status
        if docx_url is not None:
            template.docx_url = docx_url
        if updated_by_id is not None:
            template.updated_by_id = updated_by_id
        
        # 如果更新了 ProseMirror JSON，重新提取占位符并更新关联关系
        if prosemirror_json is not None:
            template.prosemirror_json = prosemirror_json
            placeholder_info = template_editor_service.extract_placeholders(prosemirror_json)
            placeholder_names = placeholder_info.get('placeholders', [])
            
            # 清除旧的关联关系（直接操作中间表，避免触发懒加载）
            from .models import template_placeholder_association
            await db.execute(
                template_placeholder_association.delete().where(
                    template_placeholder_association.c.template_id == template.id
                )
            )
            await db.flush()
            
            # 为每个占位符名称创建或获取 TemplatePlaceholder 对象并关联到模板
            placeholder_objects = []
            for placeholder_name in placeholder_names:
                # 查询是否已存在
                result = await db.execute(
                    select(TemplatePlaceholder).where(
                        TemplatePlaceholder.placeholder_name == placeholder_name
                    )
                )
                placeholder = result.scalar_one_or_none()
                
                if not placeholder:
                    # 创建新占位符（只设置 placeholder_name，其他用默认值）
                    placeholder = TemplatePlaceholder(
                        placeholder_name=placeholder_name,
                        type="text",  # 默认类型
                        required=False,  # 默认值
                        hint=None,  # 默认值
                        options=None,  # 默认值
                        created_by_id=updated_by_id,
                        updated_by_id=updated_by_id,
                    )
                    db.add(placeholder)
                    await db.flush()  # flush 以获取 placeholder.id
                    logger.info(f"创建占位符: {placeholder_name}")
                else:
                    logger.info(f"使用已存在的占位符: {placeholder_name}")
                
                placeholder_objects.append(placeholder)
            
            # 关联占位符到模板（直接操作中间表，避免触发懒加载）
            if placeholder_objects:
                for placeholder in placeholder_objects:
                    await db.execute(
                        template_placeholder_association.insert().values(
                            template_id=template.id,
                            placeholder_id=placeholder.id
                        )
                    )
        
        await db.commit()
        await db.refresh(template)
        
        logger.info(f"更新模板成功: {template.id}")
        
        return template
    
    async def delete_template(self, db: AsyncSession, template_id: int) -> bool:
        """删除文书模板"""
        template = await self.get_template(db, template_id)
        if template is None:
            return False
        
        await db.delete(template)
        await db.commit()
        
        logger.info(f"删除模板成功: {template_id}")
        
        return True


class PlaceholderService:
    """占位符服务"""
    
    async def create_or_update_placeholder(
        self,
        db: AsyncSession,
        placeholder_name: str,
        type: str,
        required: bool = False,
        hint: Optional[str] = None,
        options: Optional[List[Dict[str, Any]]] = None,
        created_by_id: Optional[int] = None,
    ) -> TemplatePlaceholder:
        """
        创建或更新占位符（以 placeholder_name 为唯一标识）
        
        Args:
            db: 数据库会话
            placeholder_name: 占位符名称（唯一）
            type: 占位符类型
            required: 是否必填
            hint: 提示文本
            options: 选项列表
            created_by_id: 创建人ID
            
        Returns:
            TemplatePlaceholder: 占位符对象
        """
        from sqlalchemy import select
        
        # 查询是否已存在
        result = await db.execute(
            select(TemplatePlaceholder).where(
                TemplatePlaceholder.placeholder_name == placeholder_name
            )
        )
        placeholder = result.scalar_one_or_none()
        
        if placeholder:
            # 更新现有占位符
            placeholder.type = type
            placeholder.required = required
            placeholder.hint = hint
            placeholder.options = options
            placeholder.updated_by_id = created_by_id
            await db.commit()
            await db.refresh(placeholder)
            logger.info(f"更新占位符成功: {placeholder_name}")
        else:
            # 创建新占位符
            placeholder = TemplatePlaceholder(
                placeholder_name=placeholder_name,
                type=type,
                required=required,
                hint=hint,
                options=options,
                created_by_id=created_by_id,
                updated_by_id=created_by_id,
            )
            db.add(placeholder)
            await db.commit()
            await db.refresh(placeholder)
            logger.info(f"创建占位符成功: {placeholder_name}")
        
        return placeholder
    
    async def get_placeholder(
        self,
        db: AsyncSession,
        placeholder_name: str,
    ) -> Optional[TemplatePlaceholder]:
        """
        根据占位符名称获取占位符
        
        Args:
            db: 数据库会话
            placeholder_name: 占位符名称
            
        Returns:
            Optional[TemplatePlaceholder]: 占位符对象，不存在返回 None
        """
        from sqlalchemy import select
        
        result = await db.execute(
            select(TemplatePlaceholder).where(
                TemplatePlaceholder.placeholder_name == placeholder_name
            )
        )
        return result.scalar_one_or_none()
    
    async def list_placeholders(
        self,
        db: AsyncSession,
        template_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[List[TemplatePlaceholder], int]:
        """
        列出占位符
        
        Args:
            db: 数据库会话
            template_id: 模板ID（可选，如果提供则只返回该模板关联的占位符）
            skip: 跳过记录数
            limit: 返回记录数限制
            
        Returns:
            tuple[List[TemplatePlaceholder], int]: (占位符列表, 总数)
        """
        from sqlalchemy import select, func
        from .models import template_placeholder_association
        
        if template_id:
            # 查询指定模板关联的占位符
            query = select(TemplatePlaceholder).join(
                template_placeholder_association
            ).where(
                template_placeholder_association.c.template_id == template_id
            )
            count_query = select(func.count()).select_from(
                TemplatePlaceholder
            ).join(
                template_placeholder_association
            ).where(
                template_placeholder_association.c.template_id == template_id
            )
        else:
            # 查询所有占位符
            query = select(TemplatePlaceholder)
            count_query = select(func.count(TemplatePlaceholder.id))
        
        # 获取总数
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0
        
        # 获取列表
        query = query.order_by(TemplatePlaceholder.created_at.desc()).offset(skip).limit(limit)
        result = await db.execute(query)
        placeholders = list(result.scalars().unique().all())
        
        return placeholders, total
    
    async def update_placeholder(
        self,
        db: AsyncSession,
        placeholder_name: str,
        new_placeholder_name: Optional[str] = None,
        type: Optional[str] = None,
        required: Optional[bool] = None,
        hint: Optional[str] = None,
        options: Optional[List[Dict[str, Any]]] = None,
        updated_by_id: Optional[int] = None,
    ) -> Optional[TemplatePlaceholder]:
        """
        更新占位符
        
        Args:
            db: 数据库会话
            placeholder_name: 占位符名称（用于查找）
            new_placeholder_name: 新的占位符名称（可选，用于重命名）
            type: 占位符类型
            required: 是否必填
            hint: 提示文本
            options: 选项列表
            updated_by_id: 更新人ID
            
        Returns:
            Optional[TemplatePlaceholder]: 更新后的占位符对象，不存在返回 None
        """
        placeholder = await self.get_placeholder(db, placeholder_name)
        if not placeholder:
            return None
        
        # 如果提供了新名称且与旧名称不同，检查新名称是否已存在
        if new_placeholder_name and new_placeholder_name != placeholder_name:
            existing = await self.get_placeholder(db, new_placeholder_name)
            if existing:
                raise ValueError(f"占位符名称 '{new_placeholder_name}' 已存在")
            placeholder.placeholder_name = new_placeholder_name
        
        if type is not None:
            placeholder.type = type
        if required is not None:
            placeholder.required = required
        if hint is not None:
            placeholder.hint = hint
        if options is not None:
            placeholder.options = options
        if updated_by_id is not None:
            placeholder.updated_by_id = updated_by_id
        
        await db.commit()
        await db.refresh(placeholder)
        
        logger.info(f"更新占位符成功: {placeholder_name}" + (f" -> {new_placeholder_name}" if new_placeholder_name else ""))
        return placeholder
    
    async def delete_placeholder(
        self,
        db: AsyncSession,
        placeholder_name: str,
    ) -> bool:
        """
        删除占位符
        
        Args:
            db: 数据库会话
            placeholder_name: 占位符名称
            
        Returns:
            bool: 是否删除成功
        """
        placeholder = await self.get_placeholder(db, placeholder_name)
        if not placeholder:
            return False
        
        await db.delete(placeholder)
        await db.commit()
        
        logger.info(f"删除占位符成功: {placeholder_name}")
        return True
    
    async def associate_placeholder_to_template(
        self,
        db: AsyncSession,
        template_id: int,
        placeholder_name: str,
    ) -> bool:
        """
        将占位符关联到模板
        
        Args:
            db: 数据库会话
            template_id: 模板ID
            placeholder_name: 占位符名称
            
        Returns:
            bool: 是否关联成功
        """
        from sqlalchemy import select
        from .models import template_placeholder_association
        
        # 获取模板和占位符
        template_result = await db.execute(
            select(DocumentTemplate).where(DocumentTemplate.id == template_id)
        )
        template = template_result.scalar_one_or_none()
        if not template:
            return False
        
        placeholder = await self.get_placeholder(db, placeholder_name)
        if not placeholder:
            return False
        
        # 检查是否已关联
        if placeholder in template.placeholders:
            return True
        
        # 关联
        template.placeholders.append(placeholder)
        await db.commit()
        
        logger.info(f"关联占位符到模板成功: template_id={template_id}, placeholder_name={placeholder_name}")
        return True
    
    async def disassociate_placeholder_from_template(
        self,
        db: AsyncSession,
        template_id: int,
        placeholder_name: str,
    ) -> bool:
        """
        从模板中移除占位符关联
        
        Args:
            db: 数据库会话
            template_id: 模板ID
            placeholder_name: 占位符名称
            
        Returns:
            bool: 是否移除成功
        """
        from sqlalchemy import select
        
        # 获取模板
        template_result = await db.execute(
            select(DocumentTemplate).where(DocumentTemplate.id == template_id)
        )
        template = template_result.scalar_one_or_none()
        if not template:
            return False
        
        placeholder = await self.get_placeholder(db, placeholder_name)
        if not placeholder:
            return False
        
        # 移除关联
        if placeholder in template.placeholders:
            template.placeholders.remove(placeholder)
            await db.commit()
            logger.info(f"移除占位符关联成功: template_id={template_id}, placeholder_name={placeholder_name}")
            return True
        
        return False


# 创建服务实例
template_editor_service = TemplateEditorService()
template_service = TemplateService()
placeholder_service = PlaceholderService()

