"""
统一的格式映射模块
确保 docx_to_html 和 update_docx_from_html 使用相同的格式处理逻辑
"""
import re
from typing import Dict, Optional, Tuple
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt


class FormatMapper:
    """统一的格式映射器，确保双向转换的格式一致性"""
    
    @staticmethod
    def css_alignment_to_docx(css_align: str) -> Optional[int]:
        """
        将CSS对齐方式转换为DOCX对齐方式
        
        Args:
            css_align: CSS text-align 值 (left, center, right, justify)
            
        Returns:
            DOCX对齐枚举值或None
        """
        css_align = css_align.lower().strip()
        if css_align == "center":
            return WD_ALIGN_PARAGRAPH.CENTER
        elif css_align == "right":
            return WD_ALIGN_PARAGRAPH.RIGHT
        elif css_align == "justify":
            return WD_ALIGN_PARAGRAPH.JUSTIFY
        else:  # left 或默认
            return WD_ALIGN_PARAGRAPH.LEFT
    
    @staticmethod
    def docx_alignment_to_css(docx_align) -> str:
        """
        将DOCX对齐方式转换为CSS对齐方式
        
        Args:
            docx_align: WD_ALIGN_PARAGRAPH 枚举值或None
            
        Returns:
            CSS text-align 值
        """
        if docx_align is None:
            return "left"
        
        if docx_align == WD_ALIGN_PARAGRAPH.CENTER:
            return "center"
        elif docx_align == WD_ALIGN_PARAGRAPH.RIGHT:
            return "right"
        elif docx_align == WD_ALIGN_PARAGRAPH.JUSTIFY:
            return "justify"
        else:
            return "left"
    
    @staticmethod
    def parse_css_style(style_str: str) -> Dict[str, str]:
        """
        解析CSS样式字符串
        
        Args:
            style_str: CSS样式字符串，如 "text-align: center; padding-left: 10pt"
            
        Returns:
            样式字典，如 {"text-align": "center", "padding-left": "10pt"}
        """
        styles = {}
        if not style_str:
            return styles
        
        # 分割样式属性
        for prop in style_str.split(';'):
            prop = prop.strip()
            if ':' in prop:
                key, value = prop.split(':', 1)
                styles[key.strip()] = value.strip()
        
        return styles
    
    @staticmethod
    def extract_paragraph_format_from_html(html_tag: str) -> Dict[str, str]:
        """
        从HTML标签中提取段落格式信息
        
        Args:
            html_tag: HTML标签字符串，如 '<p style="text-align: center; padding-left: 10pt">'
            
        Returns:
            格式信息字典，包含 alignment, indent 等
        """
        format_info = {}
        
        # 提取style属性
        style_match = re.search(r'style="([^"]*)"', html_tag)
        if style_match:
            styles = FormatMapper.parse_css_style(style_match.group(1))
            
            # 提取对齐方式
            if 'text-align' in styles:
                format_info['alignment'] = styles['text-align']
            
            # 提取缩进
            if 'text-indent' in styles:
                format_info['text-indent'] = styles['text-indent']
            if 'padding-left' in styles:
                format_info['padding-left'] = styles['padding-left']
        
        return format_info
    
    @staticmethod
    def apply_format_to_docx_paragraph(para, format_info: Dict[str, str]):
        """
        将格式信息应用到DOCX段落
        
        Args:
            para: python-docx Paragraph 对象
            format_info: 格式信息字典
        """
        from docx.shared import Pt
        
        # 应用对齐方式
        if 'alignment' in format_info:
            docx_align = FormatMapper.css_alignment_to_docx(format_info['alignment'])
            if docx_align is not None:
                para.alignment = docx_align
        
        # 应用缩进
        # text-indent: 首行缩进
        if 'text-indent' in format_info:
            indent_value = format_info['text-indent']
            indent_match = re.search(r'([\d.]+)\s*pt', indent_value)
            if indent_match:
                indent_pt = float(indent_match.group(1))
                para.paragraph_format.first_line_indent = Pt(indent_pt)
        
        # padding-left: 左缩进（整个段落）
        if 'padding-left' in format_info:
            indent_value = format_info['padding-left']
            indent_match = re.search(r'([\d.]+)\s*pt', indent_value)
            if indent_match:
                indent_pt = float(indent_match.group(1))
                para.paragraph_format.left_indent = Pt(indent_pt)
    
    @staticmethod
    def split_text_with_placeholders(text: str) -> list:
        """
        将文本分割为占位符和普通文本片段，保留换行信息
        
        Args:
            text: 包含占位符的文本，如 "姓名：{{name}}\n性别：{{gender}}"
            
        Returns:
            片段列表，每个片段是 (type, content)，type 为 'text' 或 'placeholder'
        """
        parts = []
        # 先按占位符分割
        placeholder_pattern = r'(\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\})'
        segments = re.split(placeholder_pattern, text)
        
        for segment in segments:
            if not segment:
                continue
            if re.match(placeholder_pattern, segment):
                parts.append(('placeholder', segment))
            else:
                # 处理换行：将 \n 或 <br> 转换为换行标记
                segment = segment.replace('<br>', '\n').replace('<br/>', '\n').replace('<br />', '\n')
                # 按换行分割
                lines = segment.split('\n')
                for i, line in enumerate(lines):
                    if line:
                        parts.append(('text', line))
                    if i < len(lines) - 1:  # 不是最后一行，添加换行标记
                        parts.append(('linebreak', None))
        
        return parts

