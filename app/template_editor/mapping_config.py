"""
映射配置
定义 docx 和 ProseMirror 之间的格式映射规则
"""

from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_ALIGN_VERTICAL
from typing import Dict, Any, Optional

# 对齐方式映射（双向）
ALIGNMENT_MAPPING: Dict[Any, str] = {
    # docx → ProseMirror
    WD_ALIGN_PARAGRAPH.LEFT: "left",
    WD_ALIGN_PARAGRAPH.CENTER: "center",
    WD_ALIGN_PARAGRAPH.RIGHT: "right",
    WD_ALIGN_PARAGRAPH.JUSTIFY: "justify",
    None: "left",  # 默认左对齐
}

ALIGNMENT_REVERSE_MAPPING: Dict[str, Any] = {
    # ProseMirror → docx
    "left": WD_ALIGN_PARAGRAPH.LEFT,
    "center": WD_ALIGN_PARAGRAPH.CENTER,
    "right": WD_ALIGN_PARAGRAPH.RIGHT,
    "justify": WD_ALIGN_PARAGRAPH.JUSTIFY,
}

# 垂直对齐方式映射
VERTICAL_ALIGNMENT_MAPPING: Dict[Any, str] = {
    WD_ALIGN_VERTICAL.TOP: "top",
    WD_ALIGN_VERTICAL.CENTER: "center",
    WD_ALIGN_VERTICAL.BOTTOM: "bottom",
    None: "top",
}

VERTICAL_ALIGNMENT_REVERSE_MAPPING: Dict[str, Any] = {
    "top": WD_ALIGN_VERTICAL.TOP,
    "center": WD_ALIGN_VERTICAL.CENTER,
    "bottom": WD_ALIGN_VERTICAL.BOTTOM,
}


def rgb_to_hex(rgb_color) -> Optional[str]:
    """RGBColor → 十六进制字符串"""
    if rgb_color and hasattr(rgb_color, 'rgb') and rgb_color.rgb:
        return f"#{rgb_color.rgb:06X}"
    return None


def hex_to_rgb(hex_color: str):
    """十六进制字符串 → RGBColor"""
    from docx.shared import RGBColor
    
    if hex_color and hex_color.startswith("#"):
        try:
            # 移除 # 并转换为整数
            rgb_int = int(hex_color[1:], 16)
            return RGBColor(rgb_int)
        except (ValueError, AttributeError):
            return None
    return None

