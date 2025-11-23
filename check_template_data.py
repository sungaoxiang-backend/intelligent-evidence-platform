#!/usr/bin/env python3
"""
检查现有模板数据结构
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import asyncio
from sqlalchemy import select
from app.db.session import SessionLocal
from app.template_editor.models import DocumentTemplate

async def check_template_data():
    """检查现有模板的ProseMirror JSON结构"""
    async with SessionLocal() as db:
        # 查询所有陈述式模板
        result = await db.execute(
            select(DocumentTemplate).where(
                DocumentTemplate.category.like('%陈述%')
            )
        )
        templates = result.scalars().all()

        print(f"找到 {len(templates)} 个陈述式模板")

        for i, template in enumerate(templates):
            print(f"\n=== 模板 {i+1}: {template.name} ===")
            print(f"Category: {template.category}")
            print(f"Template ID: {template.id}")

            prosemirror_json = template.prosemirror_json
            print(f"ProseMirror JSON 类型: {type(prosemirror_json)}")

            if isinstance(prosemirror_json, dict):
                print(f"根类型: {prosemirror_json.get('type')}")

                content = prosemirror_json.get('content', [])
                print(f"内容节点数量: {len(content)}")

                # 检查前几个节点
                for j, node in enumerate(content[:3]):
                    node_type = node.get('type')
                    print(f"  节点 {j}: 类型={node_type}")

                    if node_type == 'text':
                        text_content = node.get('text', '')
                        print(f"    文本内容: '{text_content}'")
                        # 检查是否包含占位符格式
                        if '{{' in text_content and '}}' in text_content:
                            print(f"    ⚠️  包含未解析的占位符!")

                    elif node_type == 'paragraph':
                        paragraph_content = node.get('content', [])
                        print(f"    段落包含 {len(paragraph_content)} 个子节点")

                        # 检查段落中的文本
                        for k, child in enumerate(paragraph_content):
                            child_type = child.get('type')
                            if child_type == 'text':
                                text_content = child.get('text', '')
                                print(f"      子节点 {k}: 文本 '{text_content}'")
                                if '{{' in text_content and '}}' in text_content:
                                    print(f"      ⚠️  包含未解析的占位符!")
                            elif child_type == 'placeholder':
                                field_key = child.get('attrs', {}).get('fieldKey', '')
                                print(f"      子节点 {k}: 占位符 '{field_key}'")

                    elif node_type == 'placeholder':
                        field_key = node.get('attrs', {}).get('fieldKey', '')
                        print(f"    占位符: '{field_key}'")

                    elif node_type == 'table':
                        print(f"    表格包含 {len(node.get('content', []))} 行")
                        # 检查表格内容
                        table_content = node.get('content', [])
                        for row_idx, row in enumerate(table_content[:2]):  # 只检查前2行
                            row_content = row.get('content', [])
                            print(f"      行 {row_idx}: {len(row_content)} 个单元格")
                            for cell_idx, cell in enumerate(row_content):
                                cell_type = cell.get('type')
                                if cell_type in ['tableCell', 'tableHeader']:
                                    cell_content = cell.get('content', [])
                                    print(f"        单元格 {cell_idx}: {len(cell_content)} 个子节点")
                                    for child in cell_content:
                                        child_type = child.get('type')
                                        if child_type == 'text':
                                            text = child.get('text', '')
                                            print(f"          文本: '{text}'")
                                            if '{{' in text and '}}' in text:
                                                print(f"          ⚠️  包含未解析的占位符!")
                                        elif child_type == 'placeholder':
                                            field_key = child.get('attrs', {}).get('fieldKey', '')
                                            print(f"          占位符: '{field_key}'")
            else:
                print(f"❌ ProseMirror JSON 不是字典类型: {prosemirror_json}")

if __name__ == "__main__":
    asyncio.run(check_template_data())