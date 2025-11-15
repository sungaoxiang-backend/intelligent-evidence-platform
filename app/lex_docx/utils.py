"""
模板解析和文档转换工具函数
"""
import io
import logging
import re
from pathlib import Path
from typing import Dict, Optional, Set

import mammoth
from docx import Document
from docx.shared import RGBColor

from app.lex_docx.schemas import PlaceholderMetadata, validate_placeholder_name

logger = logging.getLogger(__name__)


def extract_placeholders(html_content: str) -> Set[str]:
    """
    从 HTML 内容中提取所有 {{field_name}} 格式的占位符
    
    Args:
        html_content: HTML 格式的模板内容
        
    Returns:
        占位符名称集合（不包含 {{ 和 }}）
        
    Example:
        >>> html = "Hello {{name}}, your age is {{age}}"
        >>> extract_placeholders(html)
        {'name', 'age'}
    """
    if not html_content:
        return set()
    
    # 匹配 {{field_name}} 格式的占位符
    # 允许占位符名称包含字母、数字、下划线
    pattern = r'\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}'
    matches = re.findall(pattern, html_content)
    
    # 返回去重后的占位符名称集合
    return set(matches)


def docx_to_html(docx_path: str | Path) -> str:
    """
    使用 mammoth-python 将 DOCX 文件转换为 HTML
    
    Args:
        docx_path: DOCX 文件路径
        
    Returns:
        HTML 格式的字符串
        
    Raises:
        FileNotFoundError: 如果文件不存在
        Exception: 如果转换失败
    """
    docx_path = Path(docx_path)
    
    if not docx_path.exists():
        raise FileNotFoundError(f"DOCX 文件不存在: {docx_path}")
    
    try:
        with open(docx_path, "rb") as docx_file:
            result = mammoth.convert_to_html(docx_file)
            html = result.value
            
            # 记录警告（如果有）
            if result.messages:
                for message in result.messages:
                    logger.warning(f"DOCX 转换警告: {message}")
            
            return html
    except Exception as e:
        logger.error(f"DOCX 转 HTML 失败: {e}")
        raise


def docx_bytes_to_html(docx_bytes: bytes) -> str:
    """
    将 DOCX 字节数据转换为 HTML
    
    Args:
        docx_bytes: DOCX 文件的字节数据
        
    Returns:
        HTML 格式的字符串
        
    Raises:
        Exception: 如果转换失败
    """
    try:
        docx_file = io.BytesIO(docx_bytes)
        result = mammoth.convert_to_html(docx_file)
        html = result.value
        
        # 记录警告（如果有）
        if result.messages:
            for message in result.messages:
                logger.warning(f"DOCX 转换警告: {message}")
        
        return html
    except Exception as e:
        logger.error(f"DOCX 字节转 HTML 失败: {e}")
        raise


def html_to_docx(html_content: str) -> bytes:
    """
    将 HTML 内容转换为 DOCX 格式的字节数据
    
    注意：这是一个简化实现，主要用于保存模板内容。
    复杂的 HTML 格式可能无法完全保留。
    
    Args:
        html_content: HTML 格式的内容
        
    Returns:
        DOCX 文件的字节数据
        
    Raises:
        Exception: 如果转换失败
    """
    try:
        # 创建新的 Document
        doc = Document()
        
        # 简单的 HTML 解析（处理基本标签）
        # 移除占位符周围的 HTML 标签，保留占位符本身
        # 这是一个简化实现，实际项目中可能需要更复杂的 HTML 解析
        
        # 将 HTML 内容按段落分割
        paragraphs = html_content.split('\n')
        
        for para_text in paragraphs:
            if not para_text.strip():
                # 空行
                doc.add_paragraph()
                continue
            
            # 处理段落中的占位符和文本
            # 提取占位符和普通文本
            parts = re.split(r'(\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\})', para_text)
            
            paragraph = doc.add_paragraph()
            
            for part in parts:
                if not part:
                    continue
                
                # 检查是否是占位符
                if re.match(r'\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\}', part):
                    # 占位符：添加为普通文本（保持 {{field_name}} 格式）
                    run = paragraph.add_run(part)
                    # 可以设置占位符的特殊样式（如高亮）
                    run.font.color.rgb = RGBColor(0, 102, 204)  # 蓝色
                else:
                    # 普通文本
                    # 简单的 HTML 标签处理
                    text = re.sub(r'<[^>]+>', '', part)  # 移除 HTML 标签
                    text = text.replace('&nbsp;', ' ')
                    text = text.replace('&lt;', '<')
                    text = text.replace('&gt;', '>')
                    text = text.replace('&amp;', '&')
                    
                    if text.strip():
                        paragraph.add_run(text)
        
        # 将 Document 转换为字节数据
        docx_bytes = io.BytesIO()
        doc.save(docx_bytes)
        docx_bytes.seek(0)
        
        return docx_bytes.read()
    except Exception as e:
        logger.error(f"HTML 转 DOCX 失败: {e}")
        raise


def parse_placeholder_metadata(
    html_content: str,
    existing_metadata: Optional[Dict[str, PlaceholderMetadata]] = None
) -> Dict[str, PlaceholderMetadata]:
    """
    从模板内容中解析并构建占位符元数据
    
    如果占位符在 existing_metadata 中已存在，则保留现有配置。
    如果占位符不存在，则创建默认配置。
    
    Args:
        html_content: HTML 格式的模板内容
        existing_metadata: 现有的占位符元数据（可选）
        
    Returns:
        占位符元数据字典
    """
    if existing_metadata is None:
        existing_metadata = {}
    
    # 提取所有占位符
    placeholders = extract_placeholders(html_content)
    
    # 构建元数据字典
    metadata: Dict[str, PlaceholderMetadata] = {}
    
    for placeholder_name in placeholders:
        # 验证占位符名称
        try:
            validated_name = validate_placeholder_name(placeholder_name)
        except ValueError as e:
            logger.warning(f"跳过无效的占位符名称 '{placeholder_name}': {e}")
            continue
        
        # 如果已存在元数据，使用现有配置
        if validated_name in existing_metadata:
            metadata[validated_name] = existing_metadata[validated_name]
        else:
            # 创建默认元数据
            metadata[validated_name] = PlaceholderMetadata(
                type='text',  # 默认类型为文本
                label=validated_name.replace('_', ' ').title(),  # 从名称生成标签
                required=False,
                default_value=None
            )
    
    return metadata


def validate_template_content(html_content: str) -> tuple[bool, Optional[str]]:
    """
    验证模板内容是否有效
    
    Args:
        html_content: HTML 格式的模板内容
        
    Returns:
        (是否有效, 错误信息)
    """
    if not html_content or not html_content.strip():
        return False, "模板内容不能为空"
    
    # 提取所有可能的占位符（包括无效的）
    # 使用更宽松的正则表达式来匹配所有 {{...}} 格式
    pattern = r'\{\{([^}]+)\}\}'
    all_placeholders = re.findall(pattern, html_content)
    
    # 验证每个占位符名称
    for placeholder in all_placeholders:
        try:
            validate_placeholder_name(placeholder)
        except ValueError as e:
            return False, f"占位符 '{{{{ {placeholder} }}}}' 无效: {e}"
    
    return True, None

