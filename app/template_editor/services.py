"""
模板编辑器服务
提供 docx 解析和导出功能
"""

import io
import logging
from typing import Dict, Any
from docx import Document

from .mappers import DocxToProseMirrorMapper, ProseMirrorToDocxMapper

logger = logging.getLogger(__name__)


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
            doc = self.pm_to_docx_mapper.map_document(prosemirror_json)

            # 保存到字节流
            output = io.BytesIO()
            doc.save(output)
            output.seek(0)

            return output.getvalue()

        except Exception as e:
            logger.error(f"导出 docx 文件失败: {str(e)}")
            raise ValueError(f"无法导出 docx 文件: {str(e)}") from e


# 创建服务实例
template_editor_service = TemplateEditorService()

