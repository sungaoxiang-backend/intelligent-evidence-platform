"""
映射器
实现 docx 和 ProseMirror JSON 之间的双向转换
"""

import io
import logging
from typing import Dict, Any, List, Optional
import re
from docx import Document
from docx.text.paragraph import Paragraph
from docx.text.run import Run
from docx.table import Table, _Cell
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.oxml.ns import qn

from .mapping_config import (
    ALIGNMENT_MAPPING,
    ALIGNMENT_REVERSE_MAPPING,
    VERTICAL_ALIGNMENT_MAPPING,
    VERTICAL_ALIGNMENT_REVERSE_MAPPING,
    rgb_to_hex,
    hex_to_rgb,
)

logger = logging.getLogger(__name__)


class DocxToProseMirrorMapper:
    """docx → ProseMirror JSON 映射器"""

    def map_document(self, doc: Document) -> Dict[str, Any]:
        """
        映射整个文档到 ProseMirror JSON 格式

        Args:
            doc: python-docx Document 对象

        Returns:
            ProseMirror JSON 格式的文档
        """
        return {
            "type": "doc",
            "content": self._map_body_elements(doc),
        }

    def _map_body_elements(self, doc: Document) -> List[Dict[str, Any]]:
        """映射文档主体元素"""
        elements = []

        # 遍历文档的所有段落和表格
        # python-docx 的文档结构：paragraphs 和 tables 是分开的
        # 我们需要按照它们在文档中的顺序合并

        # 获取所有元素（段落和表格）的 XML 元素
        body = doc.element.body
        para_idx = 0
        table_idx = 0

        for element in body:
            if element.tag.endswith("p"):  # 段落
                if para_idx < len(doc.paragraphs):
                    para = doc.paragraphs[para_idx]
                    elements.append(self.map_paragraph(para))
                    para_idx += 1
            elif element.tag.endswith("tbl"):  # 表格
                if table_idx < len(doc.tables):
                    table = doc.tables[table_idx]
                    elements.append(self.map_table(table))
                    table_idx += 1

        return elements

    def map_paragraph(self, para: Paragraph) -> Dict[str, Any]:
        """
        映射段落

        Args:
            para: Paragraph 对象

        Returns:
            ProseMirror 段落或标题节点
        """
        attrs: Dict[str, Any] = {}

        # 对齐方式
        alignment = ALIGNMENT_MAPPING.get(para.alignment, "left")
        if alignment != "left":  # 默认左对齐，可以不设置
            attrs["textAlign"] = alignment

        # 缩进
        if para.paragraph_format.left_indent:
            attrs["indent"] = para.paragraph_format.left_indent.pt
        elif para.paragraph_format.first_line_indent:
            attrs["indent"] = para.paragraph_format.first_line_indent.pt

        # 间距（可选）
        spacing = {}
        if para.paragraph_format.space_before:
            spacing["before"] = para.paragraph_format.space_before.pt
        if para.paragraph_format.space_after:
            spacing["after"] = para.paragraph_format.space_after.pt
        if spacing:
            attrs["spacing"] = spacing

        # 文本内容
        content = self._map_runs(para.runs)

        # 检查是否是标题样式
        node_type = "paragraph"
        if para.style and para.style.name:
            style_name = para.style.name
            attrs["style"] = style_name
            
            # 将 Word 的标题样式映射到 ProseMirror 的 heading 节点
            if style_name.startswith("Heading") or style_name.startswith("标题"):
                # 提取标题级别
                level = self._extract_heading_level(style_name)
                if level:
                    node_type = "heading"
                    attrs["level"] = level
                    # 移除 style 属性，因为已经转换为 heading
                    attrs.pop("style", None)

        # 如果段落为空，返回空段落（不包含文本节点）
        # ProseMirror 允许空段落，但不允许空文本节点
        return {
            "type": node_type,
            "attrs": attrs if attrs else {},
            "content": content,  # 可能为空数组，这是允许的
        }

    def _extract_heading_level(self, style_name: str) -> Optional[int]:
        """从样式名称中提取标题级别"""
        # 处理 "Heading 1", "Heading 2" 等
        if "Heading" in style_name or "标题" in style_name:
            # 尝试提取数字
            match = re.search(r'(\d+)', style_name)
            if match:
                level = int(match.group(1))
                # 限制在 1-6 之间
                return min(max(level, 1), 6)
        return None

    def _map_runs(self, runs: List[Run]) -> List[Dict[str, Any]]:
        """映射文本运行"""
        content = []
        for run in runs:
            # 跳过空文本（ProseMirror 不允许空文本节点）
            if not run.text or run.text.strip() == "":
                continue

            text_node: Dict[str, Any] = {
                "type": "text",
                "text": run.text,
            }

            # 提取标记
            marks = self._map_marks(run)
            if marks:
                text_node["marks"] = marks

            content.append(text_node)

        return content

    def _map_marks(self, run: Run) -> List[Dict[str, Any]]:
        """映射文本标记（粗体、斜体、颜色等）"""
        marks = []

        if run.bold:
            marks.append({"type": "bold"})
        if run.italic:
            marks.append({"type": "italic"})
        if run.underline:
            marks.append({"type": "underline"})
        if run.font.strike:
            marks.append({"type": "strike"})

        # 字体颜色
        if run.font.color and run.font.color.rgb:
            color_hex = rgb_to_hex(run.font.color)
            if color_hex:
                marks.append(
                    {
                        "type": "textStyle",
                        "attrs": {"color": color_hex},
                    }
                )

        # 字体大小
        if run.font.size:
            font_size = f"{run.font.size.pt}pt"
            # 如果已经有 textStyle，合并；否则创建新的
            text_style = next(
                (m for m in marks if m.get("type") == "textStyle"), None
            )
            if text_style:
                text_style.setdefault("attrs", {})["fontSize"] = font_size
            else:
                marks.append(
                    {
                        "type": "textStyle",
                        "attrs": {"fontSize": font_size},
                    }
                )

        return marks

    def map_table(self, table: Table) -> Dict[str, Any]:
        """
        映射表格

        Args:
            table: Table 对象

        Returns:
            ProseMirror 表格节点
        """
        rows = []
        
        # 直接从 XML 读取 tc 元素，避免 python-docx 展开合并单元格的问题
        for row in table.rows:
            cells = []
            # 获取行的 XML 元素
            tr = row._tr
            # 查找所有 tc 元素（使用命名空间）
            ns = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
            tc_elements = tr.findall(f'.//{ns}tc')
            
            # 使用一个集合来跟踪已处理的单元格，避免重复处理
            processed_cells = set()
            
            for tc in tc_elements:
                # 检查这个 tc 是否已经被处理过（通过 id 或位置）
                tc_id = id(tc)
                if tc_id in processed_cells:
                    continue
                processed_cells.add(tc_id)
                
                # 从 tc 元素创建 _Cell 对象
                # 注意：我们需要找到对应的 cell 对象，或者直接从 XML 解析
                # 由于 python-docx 的限制，我们需要通过 row.cells 来找到对应的 cell
                # 但我们需要检查 tc 是否对应某个 cell
                cell = None
                for c in row.cells:
                    if c._tc is tc:
                        cell = c
                        break
                
                if cell is None:
                    # 如果找不到对应的 cell，可能是被合并的单元格，跳过
                    continue
                
                # 映射单元格（包含合并信息）
                cell_node = self.map_table_cell(cell)
                
                # 如果单元格为 None（被合并的单元格），跳过
                if cell_node is None:
                    continue
                
                cells.append(cell_node)
            
            rows.append({"type": "tableRow", "content": cells})

        attrs: Dict[str, Any] = {"border": True}

        return {
            "type": "table",
            "attrs": attrs,
            "content": rows,
        }

    def map_table_cell(self, cell: _Cell) -> Optional[Dict[str, Any]]:
        """
        映射表格单元格

        Args:
            cell: _Cell 对象

        Returns:
            ProseMirror 表格单元格节点
        """
        attrs: Dict[str, Any] = {
            "colspan": 1,
            "rowspan": 1,
        }

        # 检测合并单元格（colspan 和 rowspan）
        try:
            tc = cell._tc  # table cell element
            tc_pr = tc.tcPr  # table cell properties
            
            if tc_pr is not None:
                # 检测横向合并（colspan）
                grid_span = tc_pr.gridSpan
                if grid_span is not None:
                    # gridSpan 的值存储在 XML 属性中，需要通过 qn 获取
                    colspan_val = grid_span.get(qn('w:val'))
                    if colspan_val is not None:
                        try:
                            colspan_int = int(colspan_val)
                            if colspan_int > 1:
                                attrs["colspan"] = colspan_int
                                logger.debug(f"检测到 colspan: {colspan_int}")
                        except (ValueError, TypeError):
                            pass
                
                # 检测纵向合并（rowspan）
                v_merge = tc_pr.vMerge
                if v_merge is not None:
                    # vMerge 存在说明这个单元格参与了纵向合并
                    # 获取 vMerge 的 val 属性
                    v_merge_val = v_merge.get(qn('w:val'))
                    
                    # 如果 vMerge.val 不存在或为 "restart"，说明这是合并的起始单元格
                    if v_merge_val is None or v_merge_val == "restart":
                        # 这是合并的起始单元格，需要计算 rowspan
                        rowspan = self._calculate_rowspan(cell, tc)
                        if rowspan > 1:
                            attrs["rowspan"] = rowspan
                            logger.debug(f"检测到 rowspan: {rowspan}")
                    # 注意：被合并的单元格（vMerge.val 不存在但不是起始单元格）不会出现在 row.cells 中
        except (AttributeError, Exception) as e:
            logger.debug(f"无法检测合并单元格: {str(e)}")
            # 如果无法检测，使用默认值

        # 背景色（暂时跳过，python-docx 的 _Cell 对象没有直接的 shading 属性）
        # 如果需要支持背景色，需要通过 _tc.tcPr.shading 访问，但需要更复杂的处理
        # 暂时不提取背景色，确保基本功能可用

        # 垂直对齐
        if cell.vertical_alignment:
            vertical_align = VERTICAL_ALIGNMENT_MAPPING.get(
                cell.vertical_alignment, "top"
            )
            if vertical_align != "top":  # 默认顶部对齐
                attrs["verticalAlign"] = vertical_align

        # 单元格内容（段落列表）
        content = []
        for para in cell.paragraphs:
            para_node = self.map_paragraph(para)
            content.append(para_node)

        # 如果单元格为空，至少添加一个空段落（不包含空文本节点）
        if not content:
            content = [
                {
                    "type": "paragraph",
                    "attrs": {},
                    "content": [],  # 空段落，不包含空文本节点
                }
            ]

        # 如果 rowspan 为 0，说明这是被合并的单元格，不应该输出
        if attrs.get("rowspan") == 0:
            return None

        return {
            "type": "tableCell",
            "attrs": attrs,
            "content": content,
        }

    def _calculate_rowspan(self, cell: _Cell, tc_element) -> int:
        """
        计算单元格的 rowspan（向下合并的行数）
        
        Args:
            cell: _Cell 对象
            tc_element: 单元格的 XML 元素
            
        Returns:
            rowspan 值
        """
        try:
            # 通过 table 对象找到单元格位置
            # 找到单元格所在的表格和行
            table = None
            row = None
            row_idx = None
            col_idx = None
            
            # 遍历所有表格（从文档中）
            # 但我们需要知道 cell 属于哪个 table
            # 通过 XML 元素向上查找表格
            parent = tc_element.getparent()
            while parent is not None:
                if parent.tag.endswith('tr'):
                    # 找到行元素，现在找表格
                    tbl_parent = parent.getparent()
                    while tbl_parent is not None:
                        if tbl_parent.tag.endswith('tbl'):
                            # 找到了表格元素
                            # 现在需要找到对应的 Table 对象
                            # 通过遍历文档的表格来匹配
                            break
                        tbl_parent = tbl_parent.getparent()
                    break
                parent = parent.getparent()
            
            # 简化方法：直接通过 XML 查找
            # 找到当前单元格所在的行
            row_elem = tc_element.getparent()
            while row_elem is not None and not row_elem.tag.endswith('tr'):
                row_elem = row_elem.getparent()
            
            if row_elem is None:
                return 1
            
            # 找到表格元素
            tbl_elem = row_elem.getparent()
            while tbl_elem is not None and not tbl_elem.tag.endswith('tbl'):
                tbl_elem = tbl_elem.getparent()
            
            if tbl_elem is None:
                return 1
            
            # 找到当前单元格在行中的位置
            cells_in_row = row_elem.findall('.//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tc')
            for j, tc in enumerate(cells_in_row):
                if tc == tc_element:
                    col_idx = j
                    break
            
            if col_idx is None:
                return 1
            
            # 找到当前行在表格中的位置
            rows_in_table = tbl_elem.findall('.//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tr')
            for i, r in enumerate(rows_in_table):
                if r == row_elem:
                    row_idx = i
                    break
            
            if row_idx is None:
                return 1
            
            # 向下查找被合并的单元格
            rowspan = 1
            for i in range(row_idx + 1, len(rows_in_table)):
                next_row = rows_in_table[i]
                next_cells = next_row.findall('.//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tc')
                
                if col_idx >= len(next_cells):
                    break
                
                next_tc = next_cells[col_idx]
                next_tc_pr = next_tc.find('.//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tcPr')
                
                if next_tc_pr is not None:
                    next_v_merge = next_tc_pr.find('.//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}vMerge')
                    # 如果下一个单元格的 vMerge 没有 val 属性，说明它被合并了
                    if next_v_merge is not None:
                        # 检查命名空间
                        ns = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
                        val_attr = next_v_merge.get(ns + 'val')
                        if val_attr is None:
                            rowspan += 1
                        else:
                            break
                    else:
                        break
                else:
                    break
            
            return rowspan
        except (AttributeError, Exception) as e:
            logger.debug(f"计算 rowspan 失败: {str(e)}")
            return 1


class ProseMirrorToDocxMapper:
    """ProseMirror JSON → docx 映射器"""

    def map_document(self, prosemirror_json: Dict[str, Any]) -> Document:
        """
        从 ProseMirror JSON 映射到 docx 文档

        Args:
            prosemirror_json: ProseMirror JSON 格式的文档

        Returns:
            Document 对象
        """
        doc = Document()

        # 设置默认样式（中文字体）
        style = doc.styles["Normal"]
        style.font.name = "宋体"
        style.font.size = Pt(12)

        # 遍历内容节点
        content = prosemirror_json.get("content", [])
        for node in content:
            node_type = node.get("type")
            if node_type == "paragraph" or node_type == "heading":
                self.map_paragraph_node(node, doc)
            elif node_type == "table":
                self.map_table_node(node, doc)

        return doc

    def map_paragraph_node(
        self, node: Dict[str, Any], container: Any
    ) -> Paragraph:
        """
        映射段落节点

        Args:
            node: ProseMirror 段落节点
            container: Document 或 _Cell 对象

        Returns:
            Paragraph 对象
        """
        # 根据容器类型添加段落
        if isinstance(container, Document):
            para = container.add_paragraph()
        else:  # _Cell
            para = container.add_paragraph()

        # 应用格式
        attrs = node.get("attrs", {})

        # 对齐方式
        if "textAlign" in attrs:
            alignment = ALIGNMENT_REVERSE_MAPPING.get(
                attrs["textAlign"], WD_ALIGN_PARAGRAPH.LEFT
            )
            para.alignment = alignment

        # 缩进
        if "indent" in attrs:
            para.paragraph_format.left_indent = Pt(attrs["indent"])

        # 样式（如果是 heading，映射为 Word 的标题样式）
        if node.get("type") == "heading":
            level = attrs.get("level", 1)
            try:
                para.style = f"Heading {level}"
            except Exception:
                # 如果 Heading 样式不存在，尝试使用中文样式名
                try:
                    para.style = f"标题 {level}"
                except Exception:
                    logger.warning(f"标题样式 'Heading {level}' 不存在，使用默认样式")
        elif "style" in attrs:
            try:
                para.style = attrs["style"]
            except Exception:
                logger.warning(f"样式 '{attrs['style']}' 不存在，使用默认样式")

        # 间距
        if "spacing" in attrs:
            spacing = attrs["spacing"]
            if "before" in spacing:
                para.paragraph_format.space_before = Pt(spacing["before"])
            if "after" in spacing:
                para.paragraph_format.space_after = Pt(spacing["after"])

        # 添加文本内容
        content = node.get("content", [])
        for text_node in content:
            if text_node.get("type") == "text":
                run = para.add_run(text_node.get("text", ""))
                self._apply_marks(run, text_node.get("marks", []))

        return para

    def map_table_node(self, node: Dict[str, Any], doc: Document) -> Table:
        """
        映射表格节点

        Args:
            node: ProseMirror 表格节点
            doc: Document 对象

        Returns:
            Table 对象
        """
        rows = node.get("content", [])
        if not rows:
            return None

        # 确定列数（取最大列数）
        max_cols = max(
            (len(row.get("content", [])) for row in rows), default=1
        )

        # 创建表格
        table = doc.add_table(rows=len(rows), cols=max_cols)

        # 填充表格
        for row_idx, row_node in enumerate(rows):
            cells = row_node.get("content", [])
            for col_idx, cell_node in enumerate(cells):
                if row_idx >= len(table.rows) or col_idx >= len(
                    table.rows[row_idx].cells
                ):
                    continue

                cell = table.rows[row_idx].cells[col_idx]

                # 应用单元格格式
                attrs = cell_node.get("attrs", {})
                if "backgroundColor" in attrs:
                    self._set_cell_background_color(
                        cell, attrs["backgroundColor"]
                    )
                if "verticalAlign" in attrs:
                    alignment = VERTICAL_ALIGNMENT_REVERSE_MAPPING.get(
                        attrs["verticalAlign"], WD_ALIGN_VERTICAL.TOP
                    )
                    cell.vertical_alignment = alignment

                # 添加单元格内容
                cell_content = cell_node.get("content", [])
                for para_node in cell_content:
                    if para_node.get("type") == "paragraph":
                        self.map_paragraph_node(para_node, cell)

        return table

    def _apply_marks(self, run: Run, marks: List[Dict[str, Any]]) -> None:
        """应用文本标记到 Run 对象"""
        for mark in marks:
            mark_type = mark.get("type")
            if mark_type == "bold":
                run.bold = True
            elif mark_type == "italic":
                run.italic = True
            elif mark_type == "underline":
                run.underline = True
            elif mark_type == "strike":
                run.font.strike = True
            elif mark_type == "textStyle":
                attrs = mark.get("attrs", {})
                if "color" in attrs:
                    rgb_color = hex_to_rgb(attrs["color"])
                    if rgb_color:
                        run.font.color.rgb = rgb_color
                if "fontSize" in attrs:
                    # 解析字体大小（如 "14pt"）
                    font_size_str = attrs["fontSize"]
                    try:
                        if font_size_str.endswith("pt"):
                            size_pt = float(font_size_str[:-2])
                            run.font.size = Pt(size_pt)
                    except (ValueError, AttributeError):
                        logger.warning(f"无法解析字体大小: {font_size_str}")

    def _set_cell_background_color(self, cell: _Cell, color_hex: str) -> None:
        """设置单元格背景色（暂时不实现，需要更复杂的 XML 操作）"""
        # python-docx 的 _Cell 对象没有直接的 shading 属性
        # 设置背景色需要通过 _tc.tcPr.shading 操作 XML，暂时跳过
        pass

