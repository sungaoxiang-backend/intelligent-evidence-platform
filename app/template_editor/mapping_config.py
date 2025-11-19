"""
映射配置
定义 docx 和 ProseMirror 之间的格式映射规则
"""

from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.shared import RGBColor
from typing import Dict, Any, Optional, Sequence, Union

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


def _sanitize_rgb_value(value: Union[str, int, RGBColor, Sequence[int]]) -> Optional[str]:
    """将不同形态的 RGB 值转换为六位十六进制字符串（无 #）"""
    if value is None:
        return None

    # 如果已经是 RGBColor
    if isinstance(value, RGBColor):
        return str(value)

    # 字符串（可能带 #）
    if isinstance(value, str):
        hex_str = value.lstrip("#").strip()
        if len(hex_str) == 6:
            try:
                int(hex_str, 16)
                return hex_str.upper()
            except ValueError:
                return None
        return None

    # 单个整数（0xRRGGBB）
    if isinstance(value, int):
        if 0 <= value <= 0xFFFFFF:
            return f"{value:06X}"
        return None

    # 序列 (r, g, b)
    if isinstance(value, Sequence):
        try:
            r, g, b = value
            if all(isinstance(c, int) and 0 <= c <= 0xFF for c in (r, g, b)):
                return f"{r:02X}{g:02X}{b:02X}"
        except (ValueError, TypeError):
            return None

    return None


def rgb_to_hex(rgb_color) -> Optional[str]:
    """RGBColor/ColorFormat → 十六进制字符串（带 #）"""
    if not rgb_color:
        return None

    # 先尝试 ColorFormat.rgb 属性
    value = getattr(rgb_color, "rgb", None)
    hex_value = _sanitize_rgb_value(value)

    if hex_value is None:
        # 直接尝试传入对象本身
        hex_value = _sanitize_rgb_value(rgb_color)

    if hex_value:
        return f"#{hex_value}"
    return None


def hex_to_rgb(hex_color: str):
    """十六进制字符串 → RGBColor"""
    if not hex_color:
        return None

    hex_value = _sanitize_rgb_value(hex_color)
    if hex_value is None:
        return None

    try:
        return RGBColor.from_string(hex_value)
    except (ValueError, AttributeError):
        return None

