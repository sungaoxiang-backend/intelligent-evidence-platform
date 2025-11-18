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

from .mappers import DocxToProseMirrorMapper, ProseMirrorToDocxMapper
from .models import DocumentTemplate


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
        
        # 创建模板对象
        template = DocumentTemplate(
            name=name,
            description=description,
            category=category,
            status=status,
            prosemirror_json=prosemirror_json,
            docx_url=docx_url,
            placeholders=placeholder_info,
            created_by_id=created_by_id,
            updated_by_id=created_by_id,
        )
        
        db.add(template)
        await db.commit()
        await db.refresh(template)
        
        logger.info(f"创建模板成功: {template.id}, 名称: {name}, 占位符数量: {len(placeholder_info.get('placeholders', []))}")
        
        return template
    
    async def get_template(self, db: AsyncSession, template_id: int) -> Optional[DocumentTemplate]:
        """根据ID获取文书模板"""
        result = await db.execute(select(DocumentTemplate).where(DocumentTemplate.id == template_id))
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
        query = select(DocumentTemplate)
        
        if status:
            query = query.where(DocumentTemplate.status == status)
        if category:
            query = query.where(DocumentTemplate.category == category)
        
        query = query.offset(skip).limit(limit).order_by(DocumentTemplate.created_at.desc())
        
        result = await db.execute(query)
        return list(result.scalars().all())
    
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
        
        # 如果更新了 ProseMirror JSON，重新提取占位符
        if prosemirror_json is not None:
            template.prosemirror_json = prosemirror_json
            placeholder_info = template_editor_service.extract_placeholders(prosemirror_json)
            template.placeholders = placeholder_info
        
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


# 创建服务实例
template_editor_service = TemplateEditorService()
template_service = TemplateService()

