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
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn

from app.lex_docx.schemas import PlaceholderMetadata, validate_placeholder_name

logger = logging.getLogger(__name__)


def _get_alignment_style(alignment) -> str:
    """
    获取段落对齐方式对应的 CSS 样式
    
    Args:
        alignment: WD_ALIGN_PARAGRAPH 枚举值或 None
        
    Returns:
        CSS text-align 值
    """
    if alignment is None:
        return "left"
    
    if alignment == WD_ALIGN_PARAGRAPH.CENTER:
        return "center"
    elif alignment == WD_ALIGN_PARAGRAPH.RIGHT:
        return "right"
    elif alignment == WD_ALIGN_PARAGRAPH.JUSTIFY:
        return "justify"
    else:
        return "left"


def _get_vertical_alignment_style(vertical_alignment) -> str:
    """
    获取单元格垂直对齐方式对应的 CSS 样式
    
    Args:
        vertical_alignment: 单元格垂直对齐枚举值
        
    Returns:
        CSS vertical-align 值
    """
    if vertical_alignment is None:
        return "top"
    
    # python-docx 中垂直对齐：0=TOP, 1=CENTER, 2=BOTTOM
    if vertical_alignment == 0:  # TOP
        return "top"
    elif vertical_alignment == 1:  # CENTER
        return "middle"
    elif vertical_alignment == 2:  # BOTTOM
        return "bottom"
    else:
        return "top"


def _inject_alignment_info(html: str, doc) -> str:
    """
    将 DOCX 文档中的对齐信息注入到 HTML 中
    
    Args:
        html: mammoth 生成的 HTML
        doc: python-docx Document 对象
        
    Returns:
        注入对齐信息后的 HTML
    """
    import re
    from html import escape
    
    # 1. 为没有 border 属性的 table 添加默认样式
    html = re.sub(
        r'<table(?!\s+style)([^>]*)>',
        r'<table\1 style="border-collapse: collapse; border: 1px solid #000;">',
        html
    )
    
    # 2. 处理段落对齐
    # 收集所有段落及其对齐信息
    paragraph_alignments = {}
    for para in doc.paragraphs:
        if para.text.strip():
            text = para.text.strip()
            alignment = _get_alignment_style(para.alignment)
            # 使用文本的前50个字符作为键（避免过长）
            key = text[:50] if len(text) > 50 else text
            paragraph_alignments[key] = alignment
    
    # 为段落注入对齐样式
    for text_key, alignment in paragraph_alignments.items():
        if alignment != "left":  # 只处理非默认对齐
            # 转义特殊字符用于正则匹配
            escaped_text = re.escape(text_key)
            # 匹配包含该文本的 p 或 h 标签
            pattern = rf'<(p|h[1-6])([^>]*)>(.*?{escaped_text}.*?)</\1>'
            def add_alignment(match):
                tag = match.group(1)
                attrs = match.group(2)
                content = match.group(3)
                # 检查是否已有 style 属性
                if 'style=' in attrs:
                    # 如果已有 style，添加或更新 text-align
                    if 'text-align' not in attrs:
                        attrs = re.sub(
                            r'style="([^"]*)"',
                            rf'style="\1; text-align: {alignment};"',
                            attrs
                        )
                else:
                    attrs += f' style="text-align: {alignment};"'
                return f'<{tag}{attrs}>{content}</{tag}>'
            html = re.sub(pattern, add_alignment, html, flags=re.DOTALL)
    
    # 3. 处理表格单元格对齐
    # 收集所有表格单元格的对齐信息
    cell_info = []
    for table_idx, table in enumerate(doc.tables):
        for row_idx, row in enumerate(table.rows):
            for col_idx, cell in enumerate(row.cells):
                # 获取单元格的第一个段落的对齐方式
                cell_para_alignment = "left"
                if cell.paragraphs:
                    cell_para_alignment = _get_alignment_style(cell.paragraphs[0].alignment)
                
                # 获取单元格的垂直对齐
                cell_vertical_alignment = _get_vertical_alignment_style(cell.vertical_alignment)
                
                # 获取单元格文本内容（用于匹配）
                cell_text = cell.text.strip()
                if cell_text:
                    cell_info.append({
                        'text': cell_text[:50] if len(cell_text) > 50 else cell_text,
                        'full_text': cell_text,
                        'horizontal_align': cell_para_alignment,
                        'vertical_align': cell_vertical_alignment,
                        'is_header': row_idx == 0,  # 第一行通常是表头
                    })
    
    # 为表格单元格注入对齐样式
    for cell_data in cell_info:
        if cell_data['text']:
            escaped_text = re.escape(cell_data['text'])
            tag = 'th' if cell_data['is_header'] else 'td'
            
            # 匹配包含该文本的 td/th 标签
            pattern = rf'<{tag}([^>]*)>(.*?{escaped_text}.*?)</{tag}>'
            def add_cell_alignment(match):
                attrs = match.group(1)
                content = match.group(2)
                
                # 构建样式字符串
                styles = []
                if 'style=' in attrs:
                    # 提取现有样式
                    style_match = re.search(r'style="([^"]*)"', attrs)
                    if style_match:
                        existing_style = style_match.group(1)
                        styles.append(existing_style)
                        attrs = re.sub(r'style="[^"]*"', '', attrs)
                else:
                    # 添加默认边框样式
                    styles.append("border: 1px solid #000; padding: 4pt 8pt")
                
                # 添加对齐样式
                if cell_data['horizontal_align'] != "left":
                    styles.append(f"text-align: {cell_data['horizontal_align']}")
                if cell_data['vertical_align'] != "top":
                    styles.append(f"vertical-align: {cell_data['vertical_align']}")
                
                # 如果是表头，添加表头样式
                if cell_data['is_header']:
                    styles.append("background-color: #f0f0f0; font-weight: bold")
                    if 'text-align' not in '; '.join(styles):
                        styles.append("text-align: center")
                
                style_str = "; ".join(styles)
                return f'<{tag}{attrs} style="{style_str}">{content}</{tag}>'
            
            html = re.sub(pattern, add_cell_alignment, html, flags=re.DOTALL)
    
    # 4. 为没有 style 的 td/th 添加默认边框（如果还没有被处理）
    html = re.sub(
        r'<td(?!\s+style)([^>]*)>',
        r'<td\1 style="border: 1px solid #000; padding: 4pt 8pt; vertical-align: top; text-align: left;">',
        html
    )
    html = re.sub(
        r'<th(?!\s+style)([^>]*)>',
        r'<th\1 style="border: 1px solid #000; padding: 4pt 8pt; vertical-align: top; text-align: center; background-color: #f0f0f0; font-weight: bold;">',
        html
    )
    
    return html


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
    使用 mammoth-python 将 DOCX 文件转换为 HTML，保留样式信息
    
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
            # 使用样式映射来保留更多样式信息
            style_map = """
            p[style-name='Title'] => h1.title:fresh
            p[style-name='Heading 1'] => h1.heading1:fresh
            p[style-name='Heading 2'] => h2.heading2:fresh
            p[style-name='Heading 3'] => h3.heading3:fresh
            p[style-name='Heading 4'] => h4.heading4:fresh
            p[style-name='Heading 5'] => h5.heading5:fresh
            p[style-name='Heading 6'] => h6.heading6:fresh
            p[style-name='标题 1'] => h1.heading1:fresh
            p[style-name='标题 2'] => h2.heading2:fresh
            p[style-name='标题 3'] => h3.heading3:fresh
            p[style-name='标题'] => h1.title:fresh
            r[style-name='Strong'] => strong
            p[style-name='Normal'] => p.paragraph:fresh
            """
            
            result = mammoth.convert_to_html(
                docx_file,
                style_map=style_map,
                include_default_style_map=True  # 包含默认样式映射
            )
            html = result.value
            
            # 读取 DOCX 文件以获取对齐信息
            doc = Document(str(docx_path))
            
            # 后处理 HTML，注入对齐信息
            html = _inject_alignment_info(html, doc)
            
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
    将 DOCX 字节数据转换为 HTML，保留样式信息
    
    Args:
        docx_bytes: DOCX 文件的字节数据
        
    Returns:
        HTML 格式的字符串
        
    Raises:
        Exception: 如果转换失败
    """
    try:
        docx_file = io.BytesIO(docx_bytes)
        # 使用样式映射来保留更多样式信息
        style_map = """
        p[style-name='Title'] => h1.title:fresh
        p[style-name='Heading 1'] => h1.heading1:fresh
        p[style-name='Heading 2'] => h2.heading2:fresh
        p[style-name='Heading 3'] => h3.heading3:fresh
        p[style-name='Heading 4'] => h4.heading4:fresh
        p[style-name='Heading 5'] => h5.heading5:fresh
        p[style-name='Heading 6'] => h6.heading6:fresh
        p[style-name='标题 1'] => h1.heading1:fresh
        p[style-name='标题 2'] => h2.heading2:fresh
        p[style-name='标题 3'] => h3.heading3:fresh
        p[style-name='标题'] => h1.title:fresh
        r[style-name='Strong'] => strong
        p[style-name='Normal'] => p.paragraph:fresh
        """
        
        result = mammoth.convert_to_html(
            docx_file,
            style_map=style_map,
            include_default_style_map=True  # 包含默认样式映射
        )
        html = result.value
        
        # 读取 DOCX 文件以获取对齐信息
        docx_file.seek(0)  # 重置文件指针
        doc = Document(docx_file)
        
        # 后处理 HTML，注入对齐信息
        html = _inject_alignment_info(html, doc)
        
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

