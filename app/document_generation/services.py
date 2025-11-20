"""
文书生成服务
"""
from typing import Optional, Tuple, List, Dict, Any
from datetime import datetime
import copy
import io
import re
from loguru import logger
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.document_generation.models import DocumentGeneration
from app.template_editor.models import DocumentTemplate
from app.template_editor.services import TemplateEditorService
from app.cases.models import Case

# 懒加载 COS 服务（避免在测试时导入失败）
_cos_service = None
_template_editor_service = None

def get_cos_service():
    """获取 COS 服务实例（懒加载）"""
    global _cos_service
    if _cos_service is None:
        from app.integrations.cos import COSService
        _cos_service = COSService()
    return _cos_service

def get_template_editor_service():
    """获取模板编辑器服务实例（懒加载）"""
    global _template_editor_service
    if _template_editor_service is None:
        _template_editor_service = TemplateEditorService()
    return _template_editor_service

# 为了兼容性，保留这些模块级别的变量（但它们可以被 mock）
cos_service = None  # 将在 generate_document 中通过 get_cos_service() 获取
template_editor_service = None  # 将在 generate_document 中通过 get_template_editor_service() 获取


class DocumentGenerationService:
    """文书生成服务类"""
    
    async def get_published_templates(
        self,
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100,
        category: Optional[str] = None,
        search: Optional[str] = None
    ) -> Tuple[List[DocumentTemplate], int]:
        """
        获取已发布的模板列表
        
        Args:
            db: 数据库会话
            skip: 跳过记录数
            limit: 返回记录数
            category: 分类过滤
            search: 搜索关键词
            
        Returns:
            (模板列表, 总数)
        """
        # 构建查询
        query = select(DocumentTemplate).where(
            DocumentTemplate.status == "published"
        )
        
        # 分类过滤
        if category:
            query = query.where(DocumentTemplate.category == category)
        
        # 关键词搜索
        if search:
            query = query.where(
                DocumentTemplate.name.ilike(f"%{search}%")
            )
        
        # 获取总数
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0
        
        # 获取数据（按更新时间倒序）
        query = query.order_by(DocumentTemplate.updated_at.desc())
        query = query.offset(skip).limit(limit)
        
        # ⚠️ 重要：预加载 placeholders 关系，避免懒加载失败
        query = query.options(selectinload(DocumentTemplate.placeholders))
        
        result = await db.execute(query)
        templates = list(result.scalars().all())
        
        return templates, total
    
    async def get_generation_detail(
        self,
        db: AsyncSession,
        generation_id: int
    ) -> Optional[DocumentGeneration]:
        """
        获取文书生成记录详情（包含关联数据）
        
        Args:
            db: 数据库会话
            generation_id: 文书生成记录ID
            
        Returns:
            文书生成记录（包含 case, template, placeholders）或 None
        """
        query = select(DocumentGeneration).where(
            DocumentGeneration.id == generation_id
        ).options(
            # 预加载案件信息和当事人
            selectinload(DocumentGeneration.case).selectinload(Case.case_parties),
            # 预加载模板信息和占位符
            selectinload(DocumentGeneration.template).selectinload(
                DocumentTemplate.placeholders
            )
        )
        
        result = await db.execute(query)
        generation = result.scalar_one_or_none()
        
        return generation
    
    async def create_or_get_generation(
        self,
        db: AsyncSession,
        case_id: int,
        template_id: int,
        staff_id: int
    ) -> DocumentGeneration:
        """
        创建或获取文书生成记录（同一案件同一模板唯一）
        
        Args:
            db: 数据库会话
            case_id: 案件ID
            template_id: 模板ID
            staff_id: 员工ID
            
        Returns:
            文书生成记录
            
        Raises:
            HTTPException: 案件或模板不存在，或模板未发布
        """
        # 验证案件存在
        case = await db.get(Case, case_id)
        if not case:
            raise HTTPException(
                status_code=404,
                detail="案件不存在"
            )
        
        # 验证模板存在
        template = await db.get(DocumentTemplate, template_id)
        if not template:
            raise HTTPException(
                status_code=404,
                detail="模板不存在"
            )
        
        # 验证模板已发布
        if template.status != "published":
            raise HTTPException(
                status_code=400,
                detail="模板未发布"
            )
        
        # 查找现有记录
        query = select(DocumentGeneration).where(
            DocumentGeneration.case_id == case_id,
            DocumentGeneration.template_id == template_id
        )
        result = await db.execute(query)
        generation = result.scalar_one_or_none()
        
        if generation:
            # 更新访问时间和操作人
            generation.updated_at = datetime.now()
            generation.updated_by_id = staff_id
            await db.commit()
            await db.refresh(generation)
            return generation
        
        # 创建新记录
        generation = DocumentGeneration(
            case_id=case_id,
            template_id=template_id,
            form_data={},
            created_by_id=staff_id,
            updated_by_id=staff_id
        )
        db.add(generation)
        await db.commit()
        await db.refresh(generation)
        
        return generation
    
    async def update_generation_data(
        self,
        db: AsyncSession,
        generation_id: int,
        form_data: dict,
        staff_id: int
    ) -> DocumentGeneration:
        """
        更新文书生成的表单数据（草稿保存）
        
        Args:
            db: 数据库会话
            generation_id: 文书生成记录ID
            form_data: 表单数据
            staff_id: 员工ID
            
        Returns:
            更新后的文书生成记录
            
        Raises:
            HTTPException: 记录不存在
        """
        generation = await db.get(DocumentGeneration, generation_id)
        if not generation:
            raise HTTPException(
                status_code=404,
                detail="文书生成记录不存在"
            )
        
        generation.form_data = form_data
        generation.updated_by_id = staff_id
        generation.updated_at = datetime.now()
        
        await db.commit()
        await db.refresh(generation)
        
        return generation
    
    def _replace_placeholders_in_json(
        self,
        prosemirror_json: Dict[str, Any],
        form_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        在 ProseMirror JSON 中替换占位符
        
        Args:
            prosemirror_json: ProseMirror JSON
            form_data: 表单数据
            
        Returns:
            替换后的 ProseMirror JSON（深拷贝）
        """
        # 深拷贝以避免修改原始数据
        result = copy.deepcopy(prosemirror_json)
        
        def traverse_and_replace(node: Dict[str, Any]):
            """递归遍历并替换占位符"""
            if node.get("type") == "text":
                text = node.get("text", "")
                
                # 替换 {{placeholder}} 格式的占位符
                def replacer(match):
                    # 获取占位符名称（去除空格）
                    placeholder_name = match.group(1).strip()
                    
                    # 如果表单数据中有值，则替换
                    if placeholder_name in form_data:
                        value = form_data[placeholder_name]
                        
                        # 处理不同类型的值
                        if value is None:
                            return match.group(0)  # None 保留占位符
                        elif isinstance(value, list):
                            # 数组转换为逗号分隔的字符串
                            return "、".join(str(v) for v in value)
                        elif isinstance(value, (int, float)):
                            # 数字转换为字符串
                            return str(value)
                        elif isinstance(value, str):
                            if value == "":
                                # 空字符串替换为空
                                return ""
                            return value
                        else:
                            # 其他类型转换为字符串
                            return str(value)
                    
                    # 如果没有值，保留原占位符
                    return match.group(0)
                
                # 使用正则替换所有占位符
                node["text"] = re.sub(r'\{\{([^}]+)\}\}', replacer, text)
            
            # 递归处理子节点
            if "content" in node and isinstance(node["content"], list):
                for child in node["content"]:
                    traverse_and_replace(child)
        
        traverse_and_replace(result)
        return result
    
    async def generate_document(
        self,
        db: AsyncSession,
        generation_id: int,
        filename: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        生成并导出文书到 COS
        
        Args:
            db: 数据库会话
            generation_id: 文书生成记录ID
            filename: 自定义文件名（可选，不含扩展名）
            
        Returns:
            包含 file_url, filename, warnings 的字典
            
        Raises:
            HTTPException: 记录不存在
        """
        # 获取文书生成记录（包含模板和占位符信息）
        generation = await self.get_generation_detail(db, generation_id)
        if not generation:
            raise HTTPException(
                status_code=404,
                detail="文书生成记录不存在"
            )
        
        logger.info(f"开始生成文书，记录ID: {generation_id}")
        
        # 获取模板的 ProseMirror JSON
        template_json = generation.template.prosemirror_json
        
        # 使用表单数据替换占位符
        filled_json = self._replace_placeholders_in_json(
            template_json,
            generation.form_data
        )
        
        logger.info(f"占位符替换完成，form_data 数量: {len(generation.form_data)}")
        
        # 导出为 DOCX 字节流
        # 检查是否有 mock 的 template_editor_service
        global template_editor_service
        
        # 为了测试隔离，如果是 None，获取真实服务
        editor_service = template_editor_service if template_editor_service is not None else get_template_editor_service()
        
        export_result = editor_service.export_prosemirror_to_docx(filled_json)
        docx_bytes = export_result.get("docx_bytes")
        warnings = export_result.get("warnings", [])
        
        if not docx_bytes:
            raise HTTPException(
                status_code=500,
                detail="导出 DOCX 失败"
            )
        
        logger.info(f"DOCX 导出成功，大小: {len(docx_bytes)} bytes")
        
        # 生成文件名
        if not filename:
            # 使用模板名称和时间戳作为默认文件名
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{generation.template.name}_{timestamp}"
        
        # 确保文件名以 .docx 结尾
        if not filename.endswith(".docx"):
            filename = f"{filename}.docx"
        
        # 上传到 COS
        file_obj = io.BytesIO(docx_bytes)
        # 检查是否有 mock 的 cos_service
        global cos_service
        
        # 为了测试隔离，如果是 None，获取真实服务
        upload_service = cos_service if cos_service is not None else get_cos_service()
        
        cos_url = upload_service.upload_file(
            file=file_obj,
            filename=filename,
            folder="documents"
        )
        
        logger.info(f"文书上传到 COS 成功: {cos_url}")
        
        return {
            "file_url": cos_url,
            "filename": filename,
            "warnings": warnings
        }


# 创建服务实例
document_generation_service = DocumentGenerationService()

