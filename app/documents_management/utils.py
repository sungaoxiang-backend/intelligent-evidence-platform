"""
文书管理工具函数
"""
import re
from typing import Dict, Any, Set, List, Optional, Optional


def extract_placeholders(prosemirror_json: Dict[str, Any]) -> List[str]:
    """
    从 ProseMirror JSON 中提取占位符名称
    
    支持两种格式：
    1. placeholder 节点（type="placeholder", attrs.fieldKey）
    2. 文本中的 {{name}} 格式
    
    Args:
        prosemirror_json: ProseMirror JSON 格式的文档
        
    Returns:
        去重后的占位符名称列表
    """
    placeholders_set: Set[str] = set()
    
    def traverse_node(node: Dict[str, Any]):
        """递归遍历 ProseMirror 节点树"""
        node_type = node.get("type")
        
        # 如果是 placeholder 节点，直接提取 fieldKey
        if node_type == "placeholder":
            attrs = node.get("attrs", {})
            field_key = attrs.get("fieldKey") or attrs.get("field_key")
            if field_key:
                placeholder_name = str(field_key).strip()
                if placeholder_name:
                    placeholders_set.add(placeholder_name)
        
        # 如果是文本节点，检查文本内容中的 {{placeholder}} 格式
        elif node_type == "text":
            text = node.get("text", "")
            # 使用正则表达式提取 {{placeholder}} 格式的占位符
            pattern = r'\{\{([^}]+)\}\}'
            matches = re.finditer(pattern, text)
            
            for match in matches:
                placeholder_name = match.group(1).strip()
                if placeholder_name:
                    placeholders_set.add(placeholder_name)
        
        # 递归处理子节点
        content = node.get("content", [])
        if isinstance(content, list):
            for child in content:
                traverse_node(child)
    
    # 从根节点开始遍历
    traverse_node(prosemirror_json)
    
    # 返回去重后的占位符名称列表
    return sorted(list(placeholders_set))


def initialize_placeholder_metadata(placeholder_names: List[str], existing_metadata: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    初始化占位符元数据
    
    Args:
        placeholder_names: 占位符名称列表
        existing_metadata: 现有的元数据（用于合并）
        
    Returns:
        占位符元数据字典，格式：
        {
            "placeholder_name": {
                "name": "placeholder_name",
                "type": "",  # "text" | "radio" | "checkbox"
                "options": []  # 选项列表（用于 radio/checkbox）
            }
        }
    """
    if existing_metadata is None:
        existing_metadata = {}
    
    metadata = {}
    for name in placeholder_names:
        if name in existing_metadata:
            # 保留现有元数据
            metadata[name] = existing_metadata[name].copy()
            # 确保必需字段存在
            if "name" not in metadata[name]:
                metadata[name]["name"] = name
            if "type" not in metadata[name]:
                metadata[name]["type"] = ""
            if "options" not in metadata[name]:
                metadata[name]["options"] = []
        else:
            # 初始化新占位符
            metadata[name] = {
                "name": name,
                "type": "",  # 默认为空，用户后续配置
                "options": []  # 默认为空数组
            }
    
    return metadata


def merge_placeholder_metadata(
    new_placeholder_names: List[str],
    existing_metadata: Dict[str, Any]
) -> Dict[str, Any]:
    """
    合并新占位符与现有元数据
    
    Args:
        new_placeholder_names: 新提取的占位符名称列表
        existing_metadata: 现有的元数据
        
    Returns:
        合并后的元数据
    """
    if existing_metadata is None:
        existing_metadata = {}
    
    # 初始化新占位符的元数据
    merged = initialize_placeholder_metadata(new_placeholder_names, existing_metadata)
    
    # 移除不再存在的占位符（可选：保留已删除的占位符元数据）
    # 这里我们只保留当前文档中存在的占位符
    return {name: merged[name] for name in new_placeholder_names if name in merged}


def replace_placeholders_in_prosemirror(
    prosemirror_json: Dict[str, Any],
    form_data: Dict[str, Any],
    placeholder_metadata: Dict[str, Any] = None
) -> Dict[str, Any]:
    """
    在 ProseMirror JSON 中替换占位符为表单数据
    
    Args:
        prosemirror_json: ProseMirror JSON 格式的文档
        form_data: 表单数据，键为占位符名称，值为填充的值
        placeholder_metadata: 占位符元数据，用于格式化单选/复选类型
        
    Returns:
        替换后的 ProseMirror JSON
    """
    import copy
    
    def format_placeholder_value(placeholder_name: str, value: Any) -> str:
        """格式化占位符值"""
        if value is None:
            return ""
        
        # 如果有元数据且是单选/复选类型，格式化显示所有选项及其勾选状态
        if placeholder_metadata and placeholder_name in placeholder_metadata:
            meta = placeholder_metadata[placeholder_name]
            if isinstance(meta, dict) and meta.get("type") in ["radio", "checkbox"]:
                options = meta.get("options", [])
                if options:
                    # 获取选中的值
                    if meta["type"] == "radio":
                        selected_values = [value] if value else []
                    else:
                        selected_values = value if isinstance(value, list) else ([value] if value else [])
                    
                    # 格式化选项：☑ 已选 ☐ 未选
                    formatted_options = []
                    for option in options:
                        is_selected = option in selected_values
                        formatted_options.append(f"☑ {option}" if is_selected else f"☐ {option}")
                    
                    return "  ".join(formatted_options)
        
        # 其他类型正常处理
        if isinstance(value, list):
            return ", ".join(str(v) for v in value if v)
        return str(value)
    
    def replace_in_node(node: Dict[str, Any]) -> Dict[str, Any]:
        """递归替换节点中的占位符"""
        node = copy.deepcopy(node)
        node_type = node.get("type")
        
        # 如果是 placeholder 节点，替换为文本节点
        if node_type == "placeholder":
            attrs = node.get("attrs", {})
            field_key = attrs.get("fieldKey") or attrs.get("field_key")
            if field_key and field_key in form_data:
                value = form_data[field_key]
                # 格式化值
                display_value = format_placeholder_value(field_key, value)
                return {
                    "type": "text",
                    "text": display_value
                }
            else:
                # 如果表单数据中没有该占位符，保留原占位符或替换为空
                return {
                    "type": "text",
                    "text": ""
                }
        
        # 如果是文本节点，替换文本中的 {{placeholder}} 格式
        elif node_type == "text":
            text = node.get("text", "")
            # 使用正则表达式替换 {{placeholder}} 格式
            pattern = r'\{\{([^}]+)\}\}'
            
            def replace_match(match):
                placeholder_name = match.group(1).strip()
                if placeholder_name in form_data:
                    value = form_data[placeholder_name]
                    return format_placeholder_value(placeholder_name, value)
                else:
                    return ""  # 如果表单数据中没有该占位符，替换为空
            
            new_text = re.sub(pattern, replace_match, text)
            node["text"] = new_text
            return node
        
        # 递归处理子节点
        content = node.get("content", [])
        if isinstance(content, list):
            node["content"] = [replace_in_node(child) for child in content]
        
        return node
    
    # 从根节点开始替换
    return replace_in_node(prosemirror_json)

