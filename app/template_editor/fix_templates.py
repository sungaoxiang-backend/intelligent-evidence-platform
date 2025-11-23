"""
模板修复服务
用于修复现有模板数据中的占位符和文本结构问题
"""

import logging
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from .mappers import DocxToProseMirrorMapper
from .models import DocumentTemplate

logger = logging.getLogger(__name__)


class FixExistingTemplateService:
    """修复现有模板服务"""

    def __init__(self):
        self.mapper = DocxToProseMirrorMapper()

    def extract_placeholders_from_template(self, template_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        从模板数据中提取所有占位符

        Args:
            template_data: ProseMirror JSON 格式的模板数据

        Returns:
            占位符节点列表
        """
        placeholders = []

        def extract_nodes(node: Dict[str, Any]):
            """递归提取占位符节点"""
            node_type = node.get('type')

            if node_type == 'placeholder':
                placeholders.append(node)
            elif 'content' in node and isinstance(node['content'], list):
                for child in node['content']:
                    extract_nodes(child)

        extract_nodes(template_data)
        return placeholders

    def reconstruct_narrative_template(self, placeholders: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        根据占位符列表重新构建陈述式模板

        Args:
            placeholders: 占位符节点列表

        Returns:
            重新构建的ProseMirror JSON格式模板数据
        """
        # 提取占位符字段名
        field_keys = []
        for placeholder in placeholders:
            field_key = placeholder.get('attrs', {}).get('fieldKey', '')
            if field_key:
                field_keys.append(field_key)

        if not field_keys:
            return {
                "type": "doc",
                "content": [
                    {"type": "paragraph", "content": [{"type": "text", "text": ""}]}
                ]
            }

        # 根据常见的占位符模式判断模板类型并构建文本
        person_keys = ['姓名', '性别', '民族', '出生日期', '住址', '公民身份号码']
        case_keys = ['案号', '案由', '立案日期', '审理法院', '审判员']

        # 判断是否为个人信息类型
        if any(key in field_keys for key in person_keys):
            # 构建个人信息段落
            pattern_parts = []
            for key in ['姓名', '性别', '民族', '出生日期', '住址', '公民身份号码']:
                if key in field_keys:
                    pattern_parts.append(f"{{{{{key}}}}}")

            if pattern_parts:
                pattern_text = "，".join(pattern_parts)
            else:
                # 如果没有标准字段，按顺序排列
                pattern_parts = []
                for key in field_keys:
                    pattern_parts.append(f"{{{{{key}}}}}")
                pattern_text = "，".join(pattern_parts)

        elif any(key in field_keys for key in case_keys):
            # 构建案件信息段落
            pattern_parts = []
            for key in ['案号', '案由', '立案日期', '审理法院', '审判员']:
                if key in field_keys:
                    pattern_parts.append(f"{{{{{key}}}}}")

            if pattern_parts:
                pattern_text = "，".join(pattern_parts)
            else:
                pattern_parts = []
                for key in field_keys:
                    pattern_parts.append(f"{{{{{key}}}}}")
                pattern_text = "，".join(pattern_parts)
        else:
            # 通用模式：直接用逗号连接
            pattern_parts = []
            for key in field_keys:
                pattern_parts.append(f"{{{{{key}}}}}")
            pattern_text = "，".join(pattern_parts)

        # 使用映射器解析这个模式
        nodes = self.mapper._parse_placeholders_in_text(pattern_text)

        # 构建完整的段落节点
        paragraph_node = {
            "type": "paragraph",
            "attrs": {},
            "content": nodes
        }

        # 返回完整的文档结构
        return {
            "type": "doc",
            "content": [paragraph_node]
        }

    async def fix_template(self, template_id: int, db: AsyncSession) -> bool:
        """
        修复指定模板的数据

        Args:
            template_id: 模板ID
            db: 数据库会话

        Returns:
            修复是否成功
        """
        try:
            # 查询模板
            result = await db.execute(
                select(DocumentTemplate).where(DocumentTemplate.id == template_id)
            )
            template = result.scalar_one_or_none()

            if not template:
                logger.warning(f"模板 {template_id} 不存在")
                return False

            # 只修复陈述式模板
            if not template.category or '陈述' not in template.category:
                logger.info(f"模板 {template_id} 不是陈述式模板，跳过修复")
                return True

            logger.info(f"开始修复模板 {template_id}: {template.name}")

            # 提取现有占位符
            current_data = template.prosemirror_json
            placeholders = self.extract_placeholders_from_template(current_data)

            if not placeholders:
                logger.warning(f"模板 {template_id} 中没有找到占位符")
                return False

            logger.info(f"模板 {template_id} 中找到 {len(placeholders)} 个占位符")

            # 重新构建模板数据
            new_data = self.reconstruct_narrative_template(placeholders)

            # 更新模板数据
            template.prosemirror_json = new_data
            await db.commit()

            logger.info(f"模板 {template_id} 修复完成")
            return True

        except Exception as e:
            logger.error(f"修复模板 {template_id} 失败: {e}", exc_info=True)
            await db.rollback()
            return False

    async def fix_all_narrative_templates(self, db: AsyncSession) -> Dict[str, int]:
        """
        修复所有陈述式模板

        Args:
            db: 数据库会话

        Returns:
            修复结果统计
        """
        result = {
            "total": 0,
            "fixed": 0,
            "failed": 0,
            "skipped": 0
        }

        try:
            # 查询所有陈述式模板
            templates = await db.execute(
                select(DocumentTemplate).where(
                    DocumentTemplate.category.like('%陈述%')
                )
            )
            templates = templates.scalars().all()

            result["total"] = len(templates)
            logger.info(f"找到 {result['total']} 个陈述式模板需要修复")

            for template in templates:
                success = await self.fix_template(template.id, db)
                if success:
                    result["fixed"] += 1
                else:
                    result["failed"] += 1

            logger.info(f"模板修复完成: 总计 {result['total']}, 成功 {result['fixed']}, 失败 {result['failed']}")
            return result

        except Exception as e:
            logger.error(f"批量修复模板失败: {e}", exc_info=True)
            result["failed"] = result["total"]
            return result


# 创建全局实例
fix_existing_template_service = FixExistingTemplateService()