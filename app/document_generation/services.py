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
        form_data: Dict[str, Any],
        placeholders: Optional[List[Any]] = None,
        is_element_style: bool = False
    ) -> Dict[str, Any]:
        """
        在 ProseMirror JSON 中替换占位符
        
        Args:
            prosemirror_json: ProseMirror JSON
            form_data: 表单数据
            placeholders: 占位符元数据列表（可选）
            is_element_style: 是否为要素式（True=要素式保留节点，False=陈述式转换为文本）
            
        Returns:
            替换后的 ProseMirror JSON（深拷贝）
        """
        # 深拷贝以避免修改原始数据
        result = copy.deepcopy(prosemirror_json)
        
        # 构建占位符元数据映射
        placeholder_map = {}
        if placeholders:
            for p in placeholders:
                placeholder_map[p.name] = {
                    "type": p.type,
                    "options": p.options or []
                }
        
        # 记录占位符映射用于调试
        logger.info(f"占位符映射键: {list(placeholder_map.keys())}")
        logger.info(f"form_data 键: {list(form_data.keys()) if form_data else []}")
        logger.info(f"form_data 内容: {form_data}")
        
        def format_placeholder_value(placeholder_name: str, value: Any, meta: Optional[Dict[str, Any]] = None) -> str:
            """格式化占位符值"""
            if value is None:
                return ""  # None 替换为空内容
            
            # 对于 radio/checkbox 类型，显示所有选项和选中状态
            if meta and meta.get("type") in ["radio", "checkbox"] and meta.get("options"):
                # 处理 radio：值是单个字符串
                # 处理 checkbox：值是数组
                if meta["type"] == "radio":
                    selected_values = [value] if value else []
                else:
                    selected_values = value if isinstance(value, list) else ([value] if value else [])
                
                # 格式化选项：☑ 已选 ☐ 未选
                formatted_options = []
                for opt in meta["options"]:
                    opt_value = opt.get("value", "")
                    opt_label = opt.get("label", opt_value)
                    
                    if opt_value in selected_values:
                        formatted_options.append(f"☑ {opt_label}")
                    else:
                        formatted_options.append(f"☐ {opt_label}")
                
                return "  ".join(formatted_options)
            
            # 其他类型正常处理
            elif isinstance(value, list):
                # 数组转换为顿号分隔的字符串
                if len(value) == 0:
                    return ""  # 空数组返回空
                return "、".join(str(v) for v in value if v)  # 过滤空值
            elif isinstance(value, (int, float)):
                # 数字转换为字符串
                return str(value)
            elif isinstance(value, str):
                if value == "":
                    # 空字符串替换为空
                    return ""
                return value
            elif isinstance(value, bool):
                # 布尔值转换为字符串
                return "是" if value else "否"
            else:
                # 其他类型转换为字符串
                return str(value) if value else ""
        
        def parse_array_field_name(field_name: str):
            """解析数组格式的字段名，如 'fieldName[0]' -> ('fieldName', 0)"""
            match = re.match(r'^(.+)\[(\d+)\]$', field_name)
            if match:
                return (match.group(1), int(match.group(2)))
            return None
        
        def get_all_array_values(base_name: str, form_data: Dict[str, Any]):
            """获取所有数组格式的字段值，返回 [(index, value), ...]"""
            values = []
            for key, value in form_data.items():
                parsed = parse_array_field_name(key)
                if parsed and parsed[0] == base_name:
                    values.append((parsed[1], value))
            # 按索引排序
            values.sort(key=lambda x: x[0])
            return values
        
        def expand_cells_with_array_data(row_node: Dict[str, Any], cell_placeholders_map: Dict[int, list[str]]):
            """
            在单元格内垂直排列数组数据，保持原有样式和格式
            这是最简单有效的方案
            """
            logger.info(f"单元格扩展开始：分析行，cell_placeholders_map={cell_placeholders_map}")

            cells = row_node.get("content", [])
            if not cells:
                logger.warning("单元格扩展：行没有单元格内容")
                return

            logger.info(f"单元格扩展：原行有 {len(cells)} 个单元格")

            # 处理每个需要扩展的单元格
            for cell_idx, placeholders in cell_placeholders_map.items():
                if cell_idx >= len(cells):
                    logger.warning(f"单元格扩展：单元格索引 {cell_idx} 超出范围")
                    continue

                cell_node = cells[cell_idx]
                logger.info(f"单元格扩展：处理单元格 {cell_idx}，占位符: {placeholders}")

                # 获取第一个占位符的所有数组值
                first_placeholder = placeholders[0]
                array_values = get_all_array_values(first_placeholder, form_data)

                if not array_values or len(array_values) <= 1:
                    logger.info(f"单元格扩展：单元格 {cell_idx} 没有或只有一个数组值，跳过")
                    continue

                logger.info(f"单元格扩展：单元格 {cell_idx} 有 {len(array_values)} 个数组值")

                # 为单元格创建垂直排列的内容
                expanded_content = []
                for i, (arr_idx, _) in enumerate(array_values):
                    logger.info(f"单元格扩展：为单元格 {cell_idx} 创建第 {arr_idx} 项的内容")

                    # 为当前索引创建专用的form_data
                    temp_form_data = form_data.copy()

                    # 将当前索引的数组数据映射到普通字段名
                    for placeholder in placeholders:
                        array_field_name = f"{placeholder}[{arr_idx}]"
                        value = form_data.get(array_field_name)
                        if value is not None:
                            temp_form_data[placeholder] = value
                            logger.info(f"单元格扩展：设置 {placeholder} = {value}")

                    # 复制原始单元格结构
                    cell_copy = copy.deepcopy(cell_node)

                    # 使用正常的占位符替换流程处理这个副本
                    replace_placeholders_in_node(cell_copy, temp_form_data, placeholders)

                    # 将处理后的内容添加到扩展内容中
                    if "content" in cell_copy and cell_copy["content"]:
                        # 如果内容是段落列表，将它们添加到扩展内容
                        for content_item in cell_copy["content"]:
                            expanded_content.append(content_item)
                            logger.info(f"单元格扩展：添加了处理后的内容项")

                    # 在不同的复制项之间添加分割线（除了最后一个）
                    if i < len(array_values) - 1:
                        # 创建分割线段落 - 使用点划线字符
                        separator_paragraph = {
                            "type": "paragraph",
                            "content": [
                                {
                                    "type": "text",
                                    "text": "--------------------------------"
                                }
                            ]
                        }
                        expanded_content.append(separator_paragraph)
                        logger.info(f"单元格扩展：在第 {arr_idx} 项后添加了点划线分割线")

                # 替换单元格内容
                if expanded_content:
                    cell_node["content"] = expanded_content
                    logger.info(f"单元格扩展：单元格 {cell_idx} 内容已替换为 {len(expanded_content)} 个内容项")
                else:
                    # 如果没有内容，创建空段落
                    empty_paragraph = {
                        "type": "paragraph",
                        "content": [{"type": "text", "text": ""}]
                    }
                    cell_node["content"] = [empty_paragraph]
                    logger.info(f"单元格扩展：单元格 {cell_idx} 没有数据，创建空段落")

            logger.info("单元格扩展：处理完成")

          
        def replace_placeholders_in_node(node: Dict[str, Any], form_data_for_replacement: Dict[str, Any], cell_placeholders: list[str]):
            """在节点中替换占位符（用于单元格复制）"""
            node_type = node.get("type")

            if node_type == "placeholder":
                attrs = node.get("attrs", {})
                placeholder_name = attrs.get("fieldKey", "").strip()

                if placeholder_name and placeholder_name in form_data_for_replacement:
                    value = form_data_for_replacement[placeholder_name]
                    meta = placeholder_map.get(placeholder_name)
                    placeholder_type = meta.get("type", "text") if meta else "text"

                    if placeholder_type == "file":
                        if attrs is None:
                            attrs = {}
                        attrs["value"] = value
                        if meta:
                            attrs["placeholderType"] = "file"
                            if meta.get("options"):
                                attrs["options"] = meta["options"]
                        node["attrs"] = attrs
                    elif is_element_style:
                        if attrs is None:
                            attrs = {}
                        attrs["value"] = value
                        if meta:
                            attrs["placeholderType"] = meta.get("type", "text")
                            if meta.get("options"):
                                attrs["options"] = meta["options"]
                        node["attrs"] = attrs
                    else:
                        if value is not None:
                            formatted_value = format_placeholder_value(placeholder_name, value, meta)
                        else:
                            formatted_value = ""
                        node["type"] = "text"
                        node["text"] = formatted_value
                        if "attrs" in node:
                            del node["attrs"]

            if "content" in node and isinstance(node["content"], list):
                for child in node["content"]:
                    replace_placeholders_in_node(child, form_data_for_replacement, cell_placeholders)
        
        def traverse_and_replace(node: Dict[str, Any]):
            """递归遍历并替换占位符"""
            node_type = node.get("type")
            
            # 处理表格行：检查是否需要复制
            if node_type == "tableRow":
                # 检查行中的单元格是否包含数组格式的占位符
                cells = node.get("content", [])
                logger.info(f"表格行复制：分析表格行，有 {len(cells)} 个单元格")
                cell_placeholders_map = {}  # {cell_index: [placeholder_names]}

                for cell_idx, cell_node in enumerate(cells):
                    if cell_node.get("type") in ["tableCell", "tableHeader"]:
                        logger.info(f"表格行复制：检查单元格 {cell_idx}")
                        # 提取单元格中的所有占位符
                        cell_placeholders = []
                        def extract_from_cell(cell: Dict[str, Any]):
                            if cell.get("type") == "placeholder":
                                field_key = cell.get("attrs", {}).get("fieldKey", "").strip()
                                if field_key:
                                    cell_placeholders.append(field_key)
                            if "content" in cell and isinstance(cell["content"], list):
                                for child in cell["content"]:
                                    extract_from_cell(child)

                        extract_from_cell(cell_node)
                        logger.info(f"表格行复制：单元格 {cell_idx} 占位符: {cell_placeholders}")

                        # 检查这些占位符是否有数组格式的数据
                        has_array_data = False
                        for placeholder in cell_placeholders:
                            array_values = get_all_array_values(placeholder, form_data)
                            if array_values:
                                has_array_data = True
                                logger.info(f"表格行复制：单元格 {cell_idx} 的占位符 {placeholder} 有数组数据: {array_values}")
                                break

                        if has_array_data:
                            cell_placeholders_map[cell_idx] = cell_placeholders
                            logger.info(f"表格行复制：标记单元格 {cell_idx} 需要复制，占位符: {cell_placeholders}")
                        else:
                            logger.info(f"表格行复制：单元格 {cell_idx} 无数组数据，占位符: {cell_placeholders}")

                # 如果有需要复制的单元格，在单元格内垂直排列数据
                if cell_placeholders_map:
                    logger.info(f"表格行复制：检测到需要复制的单元格，改为单元格内垂直排列")
                    logger.info(f"表格行复制：cell_placeholders_map = {cell_placeholders_map}")
                    expand_cells_with_array_data(node, cell_placeholders_map)
                    logger.info(f"表格行复制：单元格扩展完成")
                    return
                else:
                    logger.info("表格行复制：当前行没有需要复制的单元格")
            
            # 处理 placeholder 节点类型（这是主要的占位符格式）
            if node_type == "placeholder":
                attrs = node.get("attrs", {})
                placeholder_name = attrs.get("fieldKey", "").strip()
                
                if placeholder_name:
                    # 检查是否有数组格式的数据
                    array_values = get_all_array_values(placeholder_name, form_data)
                    
                    # 获取占位符元数据
                    meta = placeholder_map.get(placeholder_name)
                    
                    # 调试日志
                    logger.debug(f"处理 placeholder 节点: {placeholder_name}, 在 form_data 中: {placeholder_name in form_data if form_data else False}, 要素式: {is_element_style}")
                    
                    # 如果有数组数据，使用第一个值（在表格行复制时已经处理了）
                    if array_values:
                        value = array_values[0][1]  # 使用第一个数组值
                    else:
                        # 获取值
                        value = form_data.get(placeholder_name) if form_data else None
                    
                    # 获取占位符类型
                    placeholder_type = meta.get("type", "text") if meta else "text"
                    
                    # file 类型占位符：无论是要素式还是陈述式，都保留为 placeholder 节点，以便导出时插入图片
                    if placeholder_type == "file":
                        # file 类型：保留 placeholder 节点，将值添加到 attrs 中
                        if attrs is None:
                            attrs = {}
                        attrs["value"] = value  # 保存原始值（COS链接）
                        if meta:
                            # 保存占位符元数据
                            attrs["placeholderType"] = "file"
                            if meta.get("options"):
                                attrs["options"] = meta["options"]
                        node["attrs"] = attrs
                        # 保留 placeholder 节点类型，不转换为 text
                    elif is_element_style:
                        # 要素式：保留 placeholder 节点，将值添加到 attrs 中
                        if attrs is None:
                            attrs = {}
                        attrs["value"] = value  # 保存原始值
                        if meta:
                            # 保存占位符元数据
                            attrs["placeholderType"] = meta.get("type", "text")
                            if meta.get("options"):
                                attrs["options"] = meta["options"]
                        node["attrs"] = attrs
                        # 保留 placeholder 节点类型，不转换为 text
                    else:
                        # 陈述式：将 placeholder 节点替换为 text 节点
                        if value is not None:
                            formatted_value = format_placeholder_value(placeholder_name, value, meta)
                        else:
                            formatted_value = ""  # 如果没有值，返回空内容
                        
                        # 将 placeholder 节点替换为 text 节点
                        node["type"] = "text"
                        node["text"] = formatted_value
                        if "attrs" in node:
                            del node["attrs"]
            
            # 处理 text 节点中的 {{placeholder}} 格式（兼容旧格式）
            elif node_type == "text":
                text = node.get("text", "")
                
                # 替换 {{placeholder}} 格式的占位符
                def replacer(match):
                    # 获取占位符名称（去除空格）
                    placeholder_name = match.group(1).strip()
                    
                    # 获取占位符元数据
                    meta = placeholder_map.get(placeholder_name)
                    
                    # 调试日志
                    logger.debug(f"处理文本中的占位符: {placeholder_name}, 在 form_data 中: {placeholder_name in form_data if form_data else False}")
                    
                    # 如果表单数据中有值，则替换
                    if placeholder_name in form_data:
                        value = form_data[placeholder_name]
                        return format_placeholder_value(placeholder_name, value, meta)
                    
                    # 如果没有值，返回空内容（不保留原占位符）
                    return ""
                
                # 使用正则替换所有占位符
                node["text"] = re.sub(r'\{\{([^}]+)\}\}', replacer, text)
            
            # 递归处理子节点
            if "content" in node and isinstance(node["content"], list):
                # 检查是否有需要替换的行
                new_content = []
                for child in node["content"]:
                    traverse_and_replace(child)
                    # 检查是否有复制的行
                    if "__duplicated_rows__" in child:
                        logger.info(f"表格行复制：发现复制标记，扩展 {len(child['__duplicated_rows__'])} 行")
                        new_content.extend(child["__duplicated_rows__"])
                        del child["__duplicated_rows__"]
                    else:
                        new_content.append(child)

                # 记录内容变化
                if len(new_content) != len(node["content"]):
                    logger.info(f"表格行复制：内容从 {len(node['content'])} 行变为 {len(new_content)} 行")
                node["content"] = new_content
        
        traverse_and_replace(result)
        
        # 清理所有标记
        def clean_marks(node: Dict[str, Any]):
            if "__duplicated_rows__" in node:
                del node["__duplicated_rows__"]
            if "content" in node and isinstance(node["content"], list):
                for child in node["content"]:
                    clean_marks(child)
        
        clean_marks(result)
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
        
        # 记录 form_data 内容用于调试
        logger.info(f"form_data 内容: {generation.form_data}")
        logger.info(f"form_data 键: {list(generation.form_data.keys()) if generation.form_data else []}")
        
        # 记录占位符信息
        placeholder_names = [p.name for p in generation.template.placeholders] if generation.template.placeholders else []
        logger.info(f"占位符名称列表: {placeholder_names}")
        
        # 获取模板的 category，判断是要素式还是陈述式
        template_category = generation.template.category or ""
        is_element_style = "要素" in template_category or template_category == "要素式"
        
        # 使用表单数据替换占位符，传递占位符元数据用于格式化选项
        filled_json = self._replace_placeholders_in_json(
            template_json,
            generation.form_data,
            generation.template.placeholders,
            is_element_style=is_element_style
        )
        
        logger.info(f"占位符替换完成，form_data 数量: {len(generation.form_data) if generation.form_data else 0}")
        
        # 导出为 DOCX 字节流
        # 检查是否有 mock 的 template_editor_service
        global template_editor_service
        
        # 为了测试隔离，如果是 None，获取真实服务
        editor_service = template_editor_service if template_editor_service is not None else get_template_editor_service()
        
        export_result = editor_service.export_prosemirror_to_docx(filled_json)
        docx_bytes = export_result.get("docx")  # 注意：键名是 "docx" 不是 "docx_bytes"
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

