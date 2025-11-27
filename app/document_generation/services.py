"""
文书生成服务
"""
from typing import Optional, Tuple, List, Dict, Any
from datetime import datetime
import copy
import io
import json
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
        staff_id: int,
        prosemirror_json: Optional[Dict[str, Any]] = None
    ) -> DocumentGeneration:
        """
        更新文书生成的表单数据（草稿保存）
        
        Args:
            db: 数据库会话
            generation_id: 文书生成记录ID
            form_data: 表单数据
            staff_id: 员工ID
            prosemirror_json: 可选的模板内容（用于保存更新后的exportEnabled状态）
            
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
        
        # 如果提供了prosemirror_json，更新模板的prosemirror_json（用于保存exportEnabled状态）
        # 注意：这里我们更新的是模板的prosemirror_json，而不是生成记录的
        # 因为exportEnabled状态是用户每次生成时的选择，不应该永久修改模板
        # 但为了保存用户的选择，我们可以将prosemirror_json存储在form_data中
        # 或者创建一个新的字段来存储
        # 目前，我们将prosemirror_json存储在form_data的一个特殊key中
        if prosemirror_json is not None:
            # 将prosemirror_json存储在form_data中，使用特殊key
            form_data["__template_content__"] = prosemirror_json
        
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

            # 方法1：查找 fieldName[0] 格式的字段名
            for key, value in form_data.items():
                parsed = parse_array_field_name(key)
                if parsed and parsed[0] == base_name:
                    values.append((parsed[1], value))

            # 方法2：如果方法1没有找到，检查直接的数组格式 {'fieldName': [value1, value2, ...]}
            if not values:
                direct_value = form_data.get(base_name)
                if isinstance(direct_value, list):
                    # 对于数组，即使只有一个元素也要处理（因为可能只有一个段落）
                    for index, value in enumerate(direct_value):
                        values.append((index, value))
                    logger.info(f"数组数据检测：发现直接数组格式 {base_name}: {direct_value} (长度: {len(direct_value)})")
                elif direct_value is not None and direct_value != "":
                    # 如果值不是数组但也不是空，也作为一个值处理（索引0）
                    values.append((0, direct_value))
                    logger.info(f"数组数据检测：发现非数组值 {base_name}: {direct_value}，作为索引0处理")

            # 按索引排序
            values.sort(key=lambda x: x[0])
            logger.info(f"数组数据检测：{base_name} 最终值列表: {values}")
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

                # 检查单元格是否有宽度或样式信息
                cell_attrs = cell_node.get("attrs", {})
                logger.info(f"单元格扩展：单元格 {cell_idx} 的 attrs: {cell_attrs}")
                logger.info(f"单元格扩展：单元格 {cell_idx} 完整结构: {json.dumps(cell_node, ensure_ascii=False)}")

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
                        # 动态计算分割线长度：基于单元格中占位符的数量和内容长度
                        total_length = 0
                        for placeholder in placeholders:
                            value = temp_form_data.get(placeholder, "")
                            if value:
                                total_length += len(str(value)) + 2  # 字符长度 + 间距
                        # 估算分割线长度，至少30个字符
                        separator_length = max(30, min(total_length, 50))
                        separator_text = "-" * separator_length

                        separator_paragraph = {
                            "type": "paragraph",
                            "content": [
                                {
                                    "type": "text",
                                    "text": separator_text
                                }
                            ]
                        }
                        expanded_content.append(separator_paragraph)
                        logger.info(f"单元格扩展：在第 {arr_idx} 项后添加了长度为 {separator_length} 的分割线")

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
        
        def expand_cells_as_narrative_paragraphs(row_node: Dict[str, Any], cell_placeholders_map: Dict[int, list[str]], form_data: Dict[str, Any], placeholder_map: Dict[str, Any], current_table_idx: int = -1, current_row_idx: int = -1):
            """
            陈述式模板：将表格单元格扩展为多个段落，不使用表格结构
            复制原始单元格的结构，保持格式
            每个单元格独立计算复制次数，只复制需要复制的单元格
            
            Args:
                row_node: 表格行节点
                cell_placeholders_map: 单元格占位符映射 {cell_idx: [placeholder_names]}
                form_data: 表单数据
                placeholder_map: 占位符元数据映射
                current_table_idx: 当前表格索引（用于精确匹配段落数量key）
                current_row_idx: 当前行索引（用于精确匹配段落数量key）
            """
            logger.info(f"陈述式段落扩展开始：分析行，cell_placeholders_map={cell_placeholders_map}, table={current_table_idx}, row={current_row_idx}")

            # 获取原始单元格节点（用于复制结构）
            cells = row_node.get("content", [])
            
            # 为每个单元格计算复制次数
            cell_replica_counts = {}  # {cell_idx: replica_count}
            for cell_idx, placeholders in cell_placeholders_map.items():
                if not placeholders:
                    continue

                first_placeholder = placeholders[0]
                replica_count = 0
                
                # 检查是否是虚拟占位符（用于没有占位符的单元格）
                if first_placeholder.startswith("__cell_") and first_placeholder.endswith("_replica__"):
                    # 从虚拟占位符中提取单元格索引：__cell_{cell_idx}_replica__
                    # 然后查找对应的段落数量key
                    # 前端使用稳定ID：table-{tableIndex}-row-{rowIndex}-cell-{cellIndex}
                    # 关键修复：使用传入的 table_idx 和 row_idx 进行精确匹配
                    paragraph_count = None
                    
                    # 精确匹配：同时匹配table、row、cell索引
                    # 关键：只使用精确匹配，不使用fallback，避免错误匹配
                    if current_table_idx >= 0 and current_row_idx >= 0:
                        expected_key = f"__paragraph_count_table-{current_table_idx}-row-{current_row_idx}-cell-{cell_idx}__"
                        if expected_key in form_data:
                            value = form_data[expected_key]
                            if isinstance(value, int) and value >= 1:
                                paragraph_count = value
                                logger.info(f"陈述式段落扩展：单元格 {cell_idx} 精确匹配到段落数量key {expected_key} = {value}")
                    
                    # 如果精确匹配失败，默认使用1
                    # 不再使用fallback逻辑，避免错误匹配到其他表格的单元格
                    if paragraph_count is None:
                        paragraph_count = 1
                        logger.info(f"陈述式段落扩展：单元格 {cell_idx} 没有找到精确匹配的段落数量key（table={current_table_idx}, row={current_row_idx}），使用默认值1")
                    
                    replica_count = paragraph_count
                else:
                    # 正常占位符，检查数组数据
                    array_values = get_all_array_values(first_placeholder, form_data)
                    if array_values:
                        replica_count = len(array_values)
                        logger.info(f"陈述式段落扩展：单元格 {cell_idx} 有 {replica_count} 个段落（占位符：{first_placeholder}，数组值：{array_values[:3]}...）")
                    else:
                        # 检查是否有单个值（非数组）
                        direct_value = form_data.get(first_placeholder)
                        if direct_value is not None and direct_value != "":
                            replica_count = 1  # 有值但不是数组，只有1个段落
                            logger.info(f"陈述式段落扩展：单元格 {cell_idx} 有1个段落（占位符：{first_placeholder}，单值：{direct_value}）")
                        else:
                            replica_count = 1  # 没有数据，默认1个
                            logger.info(f"陈述式段落扩展：单元格 {cell_idx} 没有数据，使用默认值1（占位符：{first_placeholder}）")
                
                if replica_count > 0:
                    cell_replica_counts[cell_idx] = replica_count

            # 如果没有需要复制的单元格，返回原行
            if not cell_replica_counts:
                logger.info("陈述式段落扩展：没有需要复制的单元格，返回原行")
                return

            # 找出最大的复制次数（用于确定需要创建多少个段落）
            max_replicas = max(cell_replica_counts.values()) if cell_replica_counts else 1
            logger.info(f"陈述式段落扩展：最大复制次数 = {max_replicas}, 各单元格复制次数 = {cell_replica_counts}")

            # 创建多个段落内容
            narrative_paragraphs = []
            for i in range(max_replicas):
                logger.info(f"陈述式段落扩展：创建第 {i+1} 个段落")

                # 为当前索引创建临时 form_data，包含所有占位符的值
                temp_form_data = {}
                for cell_idx, placeholders in cell_placeholders_map.items():
                    # 关键修复：只有明确标记为需要复制的单元格才处理
                    # 如果单元格不在 cell_replica_counts 中，说明它不需要复制，只在第一个段落（i==0）中处理
                    if cell_idx not in cell_replica_counts:
                        # 这个单元格不需要复制，只在第一个段落中出现
                        if i > 0:
                            logger.info(f"陈述式段落扩展：段落 {i+1}，单元格 {cell_idx} 不需要复制，跳过")
                            continue
                        # 在第一个段落中，使用原始值（非数组）
                        for placeholder in placeholders:
                            if not placeholder.startswith("__cell_") or not placeholder.endswith("_replica__"):
                                # 正常占位符，使用原始值
                                value = form_data.get(placeholder)
                                if value is not None:
                                    temp_form_data[placeholder] = value
                        continue
                    
                    # 检查这个单元格是否需要在这个索引复制
                    cell_replica_count = cell_replica_counts.get(cell_idx, 1)
                    if i >= cell_replica_count:
                        # 如果索引超出这个单元格的复制次数，跳过这个单元格
                        logger.info(f"陈述式段落扩展：段落 {i+1}，单元格 {cell_idx} 的复制次数是 {cell_replica_count}，跳过")
                        continue
                    
                    for placeholder in placeholders:
                        # 检查是否是虚拟占位符（用于没有占位符的单元格）
                        if placeholder.startswith("__cell_") and placeholder.endswith("_replica__"):
                            # 对于没有占位符的单元格，不需要设置temp_form_data
                            # 直接使用原始单元格内容，不替换占位符
                            logger.info(f"陈述式段落扩展：单元格 {cell_idx} 是虚拟占位符，跳过占位符替换")
                            continue
                        
                        # 首先尝试数组格式的字段名
                        array_field_name = f"{placeholder}[{i}]"
                        value = form_data.get(array_field_name)

                        # 如果数组格式没有找到，尝试直接数组格式
                        if value is None:
                            direct_array = form_data.get(placeholder)
                            if isinstance(direct_array, list):
                                if i < len(direct_array):
                                    value = direct_array[i]
                                    logger.info(f"陈述式段落扩展：从直接数组获取 {placeholder}[{i}] = {value}")
                                elif len(direct_array) > 0:
                                    # 如果索引超出范围，使用最后一个值（如果有的话）
                                    value = direct_array[-1]
                                    logger.info(f"陈述式段落扩展：数组索引超出范围，使用最后一个值 {placeholder}[{i}] = {value}")
                                else:
                                    # 如果数组为空，使用空字符串
                                    value = ""
                                    logger.info(f"陈述式段落扩展：数组为空，使用空值 {placeholder}[{i}] = ''")

                        # 使用基础字段名（占位符名称）作为键
                        if value is not None:
                            temp_form_data[placeholder] = value
                        # 同时支持直接使用数组格式的字段名（以防万一）
                        if value is not None:
                            temp_form_data[array_field_name] = value

                # 合并所有单元格的内容到一个段落中，保持原有模板结构
                combined_content = []

                for cell_idx, cell_node in enumerate(cells):
                    if cell_node.get("type") in ["tableCell", "tableHeader"]:
                        # 关键修复：只有明确标记为需要复制的单元格才在后续段落中处理
                        # 如果单元格不在 cell_replica_counts 中，说明它不需要复制，只在第一个段落（i==0）中处理
                        if cell_idx not in cell_replica_counts:
                            # 这个单元格不需要复制，只在第一个段落中出现
                            if i > 0:
                                continue
                            # 在第一个段落中，正常处理
                        else:
                            # 检查这个单元格是否需要在这个索引复制
                            cell_replica_count = cell_replica_counts.get(cell_idx, 1)
                            if i >= cell_replica_count:
                                # 如果索引超出这个单元格的复制次数，跳过这个单元格
                                continue
                        
                        # 深度复制单元格内容
                        cell_content = cell_node.get("content", [])
                        if cell_content:
                            copied_cell_content = copy.deepcopy(cell_content)

                            # 递归替换所有占位符
                            cell_placeholders = cell_placeholders_map.get(cell_idx, [])
                            # 过滤掉虚拟占位符
                            real_placeholders = [p for p in cell_placeholders if not (p.startswith("__cell_") and p.endswith("_replica__"))]
                            
                            for content_node in copied_cell_content:
                                replace_placeholders_in_node(content_node, temp_form_data, real_placeholders)

                            # 将处理后的内容添加到组合内容中
                            combined_content.extend(copied_cell_content)

                # 如果有内容，创建段落
                if combined_content:
                    # 检查内容是否已经是段落，如果是则直接使用，否则包装成段落
                    for content_node in combined_content:
                        if content_node.get("type") == "paragraph":
                            # 如果已经是段落，直接添加
                            narrative_paragraphs.append(content_node)
                        else:
                            # 如果不是段落，包装成段落
                            paragraph_node = {
                                "type": "paragraph",
                                "content": [content_node] if content_node else []
                            }
                            narrative_paragraphs.append(paragraph_node)
  
                    # 提取段落文本用于日志
                    if narrative_paragraphs:
                        para_text = ""
                        def extract_text(n):
                            if n.get("type") == "text":
                                return n.get("text", "")
                            elif "content" in n:
                                return "".join(extract_text(c) for c in n.get("content", []))
                            return ""
                        # 从最后添加的段落中提取文本
                        last_para = narrative_paragraphs[-1]
                        para_text = extract_text(last_para)
                        logger.info(f"陈述式段落扩展：第 {i+1} 段内容: {para_text[:100]}...")

                        # 在段落之间添加空白行（除了最后一个段落）
                        if i < max_replicas - 1:
                            empty_paragraph = {
                                "type": "paragraph",
                                "content": [
                                    {
                                        "type": "text",
                                        "text": ""
                                    }
                                ]
                            }
                            narrative_paragraphs.append(empty_paragraph)
                            logger.info(f"陈述式段落扩展：在第 {i+1} 段后添加空白行")

            # 将表格行替换为段落列表（标记为特殊类型，以便后续处理）
            # 使用特殊标记，表示这个节点应该被替换为段落
            row_node.clear()
            row_node.update({
                "type": "__narrative_paragraphs__",  # 特殊标记，表示这是段落列表
                "content": narrative_paragraphs
            })
            logger.info(f"陈述式段落扩展：生成 {len(narrative_paragraphs)} 个段落（包含空白行）")
        
        # 用于跟踪当前表格和行的索引
        table_index = [0]  # 使用列表以便在嵌套函数中修改
        row_index = [0]  # 使用列表以便在嵌套函数中修改
        
        def traverse_and_replace(node: Dict[str, Any], current_table_idx: int = -1, current_row_idx: int = -1):
            """递归遍历并替换占位符"""
            node_type = node.get("type")
            
            # 处理表格：更新表格索引
            if node_type == "table":
                current_table_idx = table_index[0]
                table_index[0] += 1
                logger.info(f"表格行复制：进入表格 {current_table_idx}")
            
            # 处理表格行：检查是否需要复制
            if node_type == "tableRow":
                # 更新行索引（在表格内）
                current_row_idx = row_index[0]
                row_index[0] += 1
                logger.info(f"表格行复制：进入表格 {current_table_idx} 的行 {current_row_idx}")
                
                # 检查行中的单元格是否包含数组格式的占位符
                cells = node.get("content", [])
                logger.info(f"表格行复制：分析表格行，有 {len(cells)} 个单元格")
                cell_placeholders_map = {}  # {cell_index: [placeholder_names]}

                for cell_idx, cell_node in enumerate(cells):
                    if cell_node.get("type") in ["tableCell", "tableHeader"]:
                        logger.info(f"表格行复制：检查表格 {current_table_idx} 行 {current_row_idx} 单元格 {cell_idx}")
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

                        # 如果没有占位符，检查是否有段落数量key（用于没有占位符的单元格）
                        if not has_array_data and not cell_placeholders:
                            # 尝试查找 __paragraph_count_* 格式的key
                            # 关键：需要精确匹配当前单元格的key，包括table、row、cell索引
                            # 前端使用稳定ID：table-{tableIndex}-row-{rowIndex}-cell-{cellIndex}
                            paragraph_count = None
                            
                            # 精确匹配：同时匹配table、row、cell索引
                            # 关键：只使用精确匹配，不使用fallback，避免错误匹配
                            if current_table_idx >= 0 and current_row_idx >= 0:
                                expected_key = f"__paragraph_count_table-{current_table_idx}-row-{current_row_idx}-cell-{cell_idx}__"
                                if expected_key in form_data:
                                    value = form_data[expected_key]
                                    if isinstance(value, int) and value >= 1:
                                        paragraph_count = value
                                        logger.info(f"表格行复制：单元格 {cell_idx} 精确匹配到段落数量key {expected_key} = {value}")
                            
                            # 如果精确匹配失败，不设置paragraph_count，让单元格保持默认的1个段落
                            # 不再使用fallback逻辑，避免错误匹配到其他表格的单元格
                            if paragraph_count is None:
                                logger.info(f"表格行复制：单元格 {cell_idx} 没有找到精确匹配的段落数量key（table={current_table_idx}, row={current_row_idx}），不标记为需要复制")
                            
                            # 只有找到精确匹配的段落数量且大于1时，才标记为需要复制
                            if paragraph_count is not None and paragraph_count > 1:
                                # 使用一个特殊的占位符名称来标记这个单元格需要复制
                                cell_placeholders = [f"__cell_{cell_idx}_replica__"]
                                has_array_data = True
                                logger.info(f"表格行复制：单元格 {cell_idx} 需要复制 {paragraph_count} 次（无占位符，精确匹配）")

                        if has_array_data:
                            cell_placeholders_map[cell_idx] = cell_placeholders
                            logger.info(f"表格行复制：标记单元格 {cell_idx} 需要复制，占位符: {cell_placeholders}")
                        else:
                            logger.info(f"表格行复制：单元格 {cell_idx} 无数组数据，占位符: {cell_placeholders}")

                # 根据模板类型选择处理方式
                if is_element_style:
                    # 要素式模板：只有需要复制时才处理，否则保留表格结构
                    if cell_placeholders_map:
                        logger.info(f"表格行复制：要素式模板，单元格内垂直排列")
                        logger.info(f"表格行复制：cell_placeholders_map = {cell_placeholders_map}")
                        expand_cells_with_array_data(node, cell_placeholders_map)
                        logger.info(f"表格行复制：单元格扩展完成")
                    else:
                        logger.info("表格行复制：要素式模板，当前行没有需要复制的单元格，保留表格结构")
                else:
                    # 陈述式模板：总是转换为段落，即使没有数组数据
                    if cell_placeholders_map:
                        logger.info(f"表格行复制：陈述式模板，有数组数据，创建多个段落")
                        logger.info(f"表格行复制：cell_placeholders_map = {cell_placeholders_map}")
                        expand_cells_as_narrative_paragraphs(node, cell_placeholders_map, form_data, placeholder_map, current_table_idx, current_row_idx)
                        logger.info(f"表格行复制：段落扩展完成")
                    else:
                        logger.info(f"表格行复制：陈述式模板，无数组数据，将表格内容转换为段落")
                        # 将表格行的所有内容转换为段落
                        cells = node.get("content", [])
                        narrative_paragraphs = []

                        for cell_idx, cell_node in enumerate(cells):
                            if cell_node.get("type") in ["tableCell", "tableHeader"]:
                                # 深度复制单元格内容
                                cell_content = cell_node.get("content", [])
                                if cell_content:
                                    copied_cell_content = copy.deepcopy(cell_content)

                                    # 递归替换所有占位符
                                    cell_placeholders = []
                                    def extract_placeholders_from_cell(cell):
                                        if cell.get("type") == "placeholder":
                                            field_key = cell.get("attrs", {}).get("fieldKey", "").strip()
                                            if field_key:
                                                cell_placeholders.append(field_key)
                                        if "content" in cell and isinstance(cell["content"], list):
                                            for child in cell["content"]:
                                                extract_placeholders_from_cell(child)

                                    extract_placeholders_from_cell(cell_node)

                                    for content_node in copied_cell_content:
                                        replace_placeholders_in_node(content_node, form_data, cell_placeholders)

                                    # 将处理后的内容添加到段落列表
                                    for content_node in copied_cell_content:
                                        if content_node.get("type") == "paragraph":
                                            narrative_paragraphs.append(content_node)
                                        else:
                                            paragraph_node = {
                                                "type": "paragraph",
                                                "content": [content_node] if content_node else []
                                            }
                                            narrative_paragraphs.append(paragraph_node)

                        # 将表格行替换为段落列表
                        node.clear()
                        node.update({
                            "type": "__narrative_paragraphs__",
                            "content": narrative_paragraphs
                        })
                        logger.info(f"陈述式段落扩展：生成 {len(narrative_paragraphs)} 个段落")
                    return
            
            # 处理 placeholder 节点类型（这是主要的占位符格式）
            if node_type == "placeholder":
                attrs = node.get("attrs", {})
                placeholder_name = attrs.get("fieldKey", "").strip()
                
                if placeholder_name:
                    # 获取占位符元数据
                    meta = placeholder_map.get(placeholder_name)
                    
                    # 调试日志
                    logger.info(f"处理 placeholder 节点: {placeholder_name}, 在 form_data 中: {placeholder_name in form_data if form_data else False}, 要素式: {is_element_style}")
                    if form_data and placeholder_name in form_data:
                        logger.info(f"  form_data[{placeholder_name}] = {form_data[placeholder_name]} (type: {type(form_data[placeholder_name])})")
                    
                    # 首先尝试直接获取值（优先使用直接值，因为数组值在表格行复制时已经处理了）
                    value = form_data.get(placeholder_name) if form_data else None
                    logger.info(f"  直接获取值: {placeholder_name} = {value}")
                    
                    # 如果直接值不存在，检查是否有数组格式的数据
                    if value is None:
                        array_values = get_all_array_values(placeholder_name, form_data)
                        if array_values:
                            value = array_values[0][1]  # 使用第一个数组值
                            logger.info(f"  从数组获取值: {placeholder_name} = {value}")
                    
                    # 如果还是没有值，尝试检查是否有数组格式的字段名（如 fieldName[0]）
                    if value is None:
                        array_field_name = f"{placeholder_name}[0]"
                        value = form_data.get(array_field_name) if form_data else None
                        if value is not None:
                            logger.info(f"  从数组格式字段名获取值: {array_field_name} = {value}")
                    
                    # 获取占位符类型
                    placeholder_type = meta.get("type", "text") if meta else "text"
                    logger.info(f"  占位符类型: {placeholder_type}, 最终值: {value}")
                    
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
                        logger.info(f"  设置 file 类型占位符值: {placeholder_name} = {value}")
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
                        logger.info(f"  设置要素式占位符值: {placeholder_name} = {value}, attrs = {node['attrs']}")
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
            
            # 对于表格节点，先过滤掉 exportEnabled: false 的行，然后再递归处理
            if node_type == "table":
                rows = node.get("content", [])
                # 过滤掉 exportEnabled: false 的行
                filtered_rows = []
                for row_idx, row in enumerate(rows):
                    # 检查是否是表格行
                    if row.get("type") == "tableRow":
                        # 检查 exportEnabled 属性，默认为 True（向后兼容）
                        attrs = row.get("attrs", {})
                        export_enabled = attrs.get("exportEnabled", True)
                        
                        # 提取行的预览文本用于调试
                        preview_text = ""
                        try:
                            if row.get("content") and len(row.get("content", [])) > 0:
                                first_cell = row.get("content", [])[0]
                                if first_cell.get("content"):
                                    text_nodes = [item.get("text", "") for item in first_cell.get("content", []) if item.get("type") == "text"]
                                    preview_text = "".join(text_nodes)[:50]
                        except:
                            pass
                        
                        # 详细日志：记录每行的exportEnabled状态
                        logger.info(f"表格行导出检查 [行{row_idx}]: type={row.get('type')}, exportEnabled={export_enabled} (type: {type(export_enabled).__name__}), preview='{preview_text}', attrs={attrs}")
                        
                        # 如果 exportEnabled 为 False，跳过该行
                        # 需要明确检查 False（布尔值False）
                        if export_enabled is False:
                            logger.info(f"表格行导出过滤 [行{row_idx}]: 跳过 exportEnabled=false 的行 (preview: '{preview_text}')")
                            continue
                        elif export_enabled == False:  # 处理可能的字符串"false"或其他假值
                            logger.info(f"表格行导出过滤 [行{row_idx}]: 跳过 exportEnabled=false 的行（非布尔False）(preview: '{preview_text}')")
                            continue
                        else:
                            logger.info(f"表格行导出保留 [行{row_idx}]: exportEnabled={export_enabled} (preview: '{preview_text}')")
                    # 保留该行
                    filtered_rows.append(row)
                
                # 更新表格内容为过滤后的行
                if len(filtered_rows) != len(rows):
                    logger.info(f"表格行导出过滤：从 {len(rows)} 行过滤到 {len(filtered_rows)} 行")
                    node["content"] = filtered_rows
            
            # 递归处理子节点
            if "content" in node and isinstance(node["content"], list):
                # 检查是否有需要替换的行
                new_content = []
                for child in node["content"]:
                    # 如果当前节点是表格，重置行索引并传递表格索引
                    if node_type == "table":
                        row_index[0] = 0
                        traverse_and_replace(child, current_table_idx, -1)
                    elif node_type == "tableRow":
                        # 传递表格和行索引给子节点
                        traverse_and_replace(child, current_table_idx, current_row_idx)
                    else:
                        # 其他节点，保持当前的table和row索引
                        traverse_and_replace(child, current_table_idx, current_row_idx)
                    # 检查是否有复制的行
                    if "__duplicated_rows__" in child:
                        logger.info(f"表格行复制：发现复制标记，扩展 {len(child['__duplicated_rows__'])} 行")
                        new_content.extend(child["__duplicated_rows__"])
                        del child["__duplicated_rows__"]
                    # 检查是否是陈述式段落（表格行被替换为段落）
                    elif child.get("type") == "__narrative_paragraphs__":
                        logger.info(f"陈述式段落：发现段落列表，包含 {len(child.get('content', []))} 个段落")
                        # 将段落列表展开到父节点中
                        new_content.extend(child.get("content", []))
                    else:
                        new_content.append(child)

                # 记录内容变化
                if len(new_content) != len(node["content"]):
                    logger.info(f"表格行复制：内容从 {len(node['content'])} 行变为 {len(new_content)} 行")
                node["content"] = new_content
                
            # 处理表格节点：如果表格行被替换为段落，则将整个表格替换为段落列表
            # 注意：这个检查必须在递归处理子节点之后
            if node_type == "table":
                rows = node.get("content", [])
                # 检查是否所有行都被替换为段落（在递归处理后，行已经被展开为段落）
                # 如果表格的内容现在都是段落，说明表格应该被替换
                all_content_are_paragraphs = all(
                    item.get("type") == "paragraph" or item.get("type") == "heading"
                    for item in rows
                )
                has_paragraphs = any(
                    item.get("type") == "paragraph" or item.get("type") == "heading"
                    for item in rows
                )
                # 如果表格包含段落（说明有行被替换为段落），则将整个表格替换为段落列表
                if has_paragraphs and rows:
                    logger.info(f"陈述式表格：表格包含段落，将表格转换为段落列表（共 {len(rows)} 个段落）")
                    # 过滤出段落节点（忽略其他类型的节点）
                    paragraph_nodes = [
                        item for item in rows 
                        if item.get("type") == "paragraph" or item.get("type") == "heading"
                    ]
                    if paragraph_nodes:
                        # 将表格节点替换为段落列表（标记为段落容器）
                        node.clear()
                        node.update({
                            "type": "__narrative_table_replacement__",  # 特殊标记，表示这是表格的段落替换
                            "content": paragraph_nodes
                        })
                        logger.info(f"陈述式表格：生成 {len(paragraph_nodes)} 个段落")
        
        traverse_and_replace(result)
        
        # 清理所有标记，并将特殊标记的节点转换为正常节点
        def clean_marks(node: Dict[str, Any]):
            node_type = node.get("type")
            # 将陈述式表格替换标记转换为段落列表
            if node_type == "__narrative_table_replacement__":
                # 将标记节点替换为段落列表（在父节点中展开）
                paragraphs = node.get("content", [])
                # 这个节点会被父节点处理，这里先标记
                node["__replace_with_paragraphs__"] = paragraphs
            # 将陈述式段落标记转换为段落列表
            elif node_type == "__narrative_paragraphs__":
                paragraphs = node.get("content", [])
                node["__replace_with_paragraphs__"] = paragraphs
            elif "__duplicated_rows__" in node:
                del node["__duplicated_rows__"]
            if "content" in node and isinstance(node["content"], list):
                new_content = []
                for child in node["content"]:
                    clean_marks(child)
                    # 如果子节点需要替换为段落，展开它
                    if "__replace_with_paragraphs__" in child:
                        new_content.extend(child["__replace_with_paragraphs__"])
                        del child["__replace_with_paragraphs__"]
                    else:
                        new_content.append(child)
                node["content"] = new_content
        
        clean_marks(result)
        
        # 最后清理：将文档根节点中的表格替换标记展开为段落
        if "content" in result and isinstance(result["content"], list):
            final_content = []
            for child in result["content"]:
                if child.get("type") == "__narrative_table_replacement__":
                    final_content.extend(child.get("content", []))
                elif "__replace_with_paragraphs__" in child:
                    final_content.extend(child["__replace_with_paragraphs__"])
                else:
                    final_content.append(child)
            result["content"] = final_content
        
        return result
    
    async def generate_document(
        self,
        db: AsyncSession,
        generation_id: int,
        filename: Optional[str] = None,
        prosemirror_json: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        生成并导出文书到 COS
        
        Args:
            db: 数据库会话
            generation_id: 文书生成记录ID
            filename: 自定义文件名（可选，不含扩展名）
            prosemirror_json: 可选的模板内容（用于传递更新后的exportEnabled状态）
            
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
        # 优先使用请求中的prosemirror_json（包含exportEnabled状态）
        # 如果没有，尝试从form_data中恢复保存的templateContent
        # 最后使用模板的原始内容
        if prosemirror_json is not None:
            template_json = prosemirror_json
            logger.info("使用请求中的prosemirror_json（包含exportEnabled状态）")
            
            # 调试：检查exportEnabled状态
            def count_table_rows(json_data, path=""):
                """递归统计表格行及其exportEnabled状态"""
                if isinstance(json_data, dict):
                    if json_data.get("type") == "tableRow":
                        attrs = json_data.get("attrs", {})
                        export_enabled = attrs.get("exportEnabled", True)
                        return [{"path": path, "exportEnabled": export_enabled}]
                    elif json_data.get("type") == "table":
                        rows = []
                        content = json_data.get("content", [])
                        for idx, item in enumerate(content):
                            if isinstance(item, dict) and item.get("type") == "tableRow":
                                attrs = item.get("attrs", {})
                                export_enabled = attrs.get("exportEnabled", True)
                                rows.append({"path": f"{path}[{idx}]", "exportEnabled": export_enabled})
                        return rows
                    else:
                        rows = []
                        content = json_data.get("content", [])
                        if isinstance(content, list):
                            for idx, item in enumerate(content):
                                rows.extend(count_table_rows(item, f"{path}[{idx}]"))
                        return rows
                return []
            
            table_rows_info = count_table_rows(template_json)
            logger.info(f"导出前表格行状态检查: 共 {len(table_rows_info)} 行")
            for row_info in table_rows_info:
                logger.info(f"  行 {row_info['path']}: exportEnabled={row_info['exportEnabled']}")
        elif generation.form_data and isinstance(generation.form_data, dict):
            saved_template_content = generation.form_data.get("__template_content__")
            if saved_template_content:
                template_json = saved_template_content
                logger.info("从form_data中恢复保存的templateContent（包含exportEnabled状态）")
            else:
                template_json = generation.template.prosemirror_json
                logger.info("使用模板的原始prosemirror_json")
        else:
            template_json = generation.template.prosemirror_json
            logger.info("使用模板的原始prosemirror_json")
        
        # 记录 form_data 内容用于调试
        logger.info(f"form_data 内容: {generation.form_data}")
        logger.info(f"form_data 键: {list(generation.form_data.keys()) if generation.form_data else []}")
        
        # 关键调试：记录段落数量key
        if generation.form_data:
            paragraph_count_keys = [k for k in generation.form_data.keys() if k.startswith("__paragraph_count_")]
            if paragraph_count_keys:
                logger.info(f"段落数量key: {paragraph_count_keys}")
                for key in paragraph_count_keys:
                    logger.info(f"  {key} = {generation.form_data[key]}")
            else:
                logger.info("未找到段落数量key（__paragraph_count_*）")
        
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
        
        export_result = editor_service.export_prosemirror_to_docx(filled_json, is_narrative_style=not is_element_style)
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

