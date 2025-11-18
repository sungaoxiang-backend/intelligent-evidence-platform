"""
模板编辑器服务
提供 docx 解析和导出功能
"""

import io
from typing import Dict, Any
from docx import Document
from loguru import logger

from .mappers import DocxToProseMirrorMapper, ProseMirrorToDocxMapper


class TemplateEditorService:
    """模板编辑器服务"""

    def __init__(self):
        self.docx_to_pm_mapper = DocxToProseMirrorMapper()
        self.pm_to_docx_mapper = ProseMirrorToDocxMapper()

    def parse_docx_to_prosemirror(self, docx_bytes: bytes) -> Dict[str, Any]:
        """
        解析 docx 文件为 ProseMirror JSON 格式

        Args:
            docx_bytes: docx 文件的字节流

        Returns:
            ProseMirror JSON 格式的文档

        Raises:
            ValueError: 如果文件格式无效
        """
        try:
            # 从字节流创建 Document 对象
            doc = Document(io.BytesIO(docx_bytes))

            # 使用映射器转换为 ProseMirror JSON
            prosemirror_json = self.docx_to_pm_mapper.map_document(doc)

            # 记录解析结果（用于调试）
            content_count = len(prosemirror_json.get("content", []))
            logger.info(f"解析 docx 成功，共 {content_count} 个元素")
            if content_count > 0:
                first_element = prosemirror_json["content"][0]
                logger.info(f"第一个元素类型: {first_element.get('type')}")

            return prosemirror_json

        except Exception as e:
            logger.error(f"解析 docx 文件失败: {str(e)}")
            raise ValueError(f"无法解析 docx 文件: {str(e)}") from e

    def export_prosemirror_to_docx(
        self, prosemirror_json: Dict[str, Any]
    ) -> bytes:
        """
        从 ProseMirror JSON 导出为 docx 文件

        Args:
            prosemirror_json: ProseMirror JSON 格式的文档

        Returns:
            docx 文件的字节流

        Raises:
            ValueError: 如果 JSON 格式无效
        """
        try:
            # 验证 JSON 格式
            if not isinstance(prosemirror_json, dict):
                raise ValueError("ProseMirror JSON 必须是字典类型")

            if prosemirror_json.get("type") != "doc":
                raise ValueError(
                    "ProseMirror JSON 的根节点类型必须是 'doc'"
                )

            # 使用映射器转换为 docx
            logger.info("开始转换 ProseMirror JSON 到 DOCX")
            doc = self.pm_to_docx_mapper.map_document(prosemirror_json)
            logger.info("DOCX 文档创建成功")
            
            # 验证表格列宽（在保存前）
            if doc.tables:
                from docx.oxml.ns import qn
                ns = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
                for table_idx, table in enumerate(doc.tables):
                    tbl = table._tbl
                    tbl_grid = tbl.tblGrid
                    if tbl_grid is not None:
                        grid_cols = tbl_grid.findall(f'.//{ns}gridCol')
                        logger.info(f"[SERVICE] 保存前验证 - 表格{table_idx} tblGrid 列宽:")
                        for i, grid_col in enumerate(grid_cols):
                            width = grid_col.get(qn('w:w'))
                            width_type = grid_col.get(qn('w:type'))
                            logger.info(f"[SERVICE]   列 {i}: width={width}, type={width_type}")

            # 保存到字节流
            logger.info("开始保存 DOCX 到字节流")
            output = io.BytesIO()
            doc.save(output)
            logger.info("DOCX 保存到字节流成功")
            output.seek(0)
            docx_bytes = output.getvalue()
            logger.info(f"DOCX 字节流大小: {len(docx_bytes)} bytes")
            
            # 验证保存后的列宽（重新读取）
            from docx import Document
            doc_verify = Document(io.BytesIO(docx_bytes))
            if doc_verify.tables:
                from docx.oxml.ns import qn
                ns = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
                for table_idx, table in enumerate(doc_verify.tables):
                    tbl = table._tbl
                    tbl_grid = tbl.tblGrid
                    if tbl_grid is not None:
                        grid_cols = tbl_grid.findall(f'.//{ns}gridCol')
                        logger.info(f"[SERVICE] 保存后验证 - 表格{table_idx} tblGrid 列宽:")
                        for i, grid_col in enumerate(grid_cols):
                            width = grid_col.get(qn('w:w'))
                            width_type = grid_col.get(qn('w:type'))
                            logger.info(f"[SERVICE]   列 {i}: width={width}, type={width_type}")
            
            return docx_bytes

        except UnicodeEncodeError as e:
            logger.error(f"编码错误 - 位置: {e.start}-{e.end}, 对象: {e.object}, 错误: {str(e)}")
            raise ValueError(f"无法导出 docx 文件: 编码错误 - {str(e)}") from e
        except Exception as e:
            logger.error(f"导出 docx 文件失败: {str(e)}", exc_info=True)
            raise ValueError(f"无法导出 docx 文件: {str(e)}") from e


# 创建服务实例
template_editor_service = TemplateEditorService()

