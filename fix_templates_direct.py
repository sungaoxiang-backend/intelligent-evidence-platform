#!/usr/bin/env python3
"""
直接修复模板数据脚本
"""

import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import SessionLocal
from app.template_editor.models import DocumentTemplate
from app.template_editor.fix_templates import fix_existing_template_service

async def main():
    """主函数：修复所有陈述式模板"""
    print("=== 开始修复陈述式模板数据 ===")

    async with SessionLocal() as db:
        # 先查看有多少个陈述式模板
        result = await db.execute(
            select(DocumentTemplate).where(
                DocumentTemplate.category.like('%陈述%')
            )
        )
        templates = result.scalars().all()

        print(f"找到 {len(templates)} 个陈述式模板:")

        for i, template in enumerate(templates):
            print(f"  {i+1}. ID: {template.id}, 名称: {template.name}, 类别: {template.category}")

        if not templates:
            print("没有找到陈述式模板，退出")
            return

        print("\n开始修复...")

        # 逐个修复模板
        success_count = 0
        for template in templates:
            print(f"\n正在修复模板 ID: {template.id} - {template.name}")

            try:
                success = await fix_existing_template_service.fix_template(template.id, db)
                if success:
                    print(f"✅ 模板 {template.id} 修复成功")
                    success_count += 1
                else:
                    print(f"❌ 模板 {template.id} 修复失败")
            except Exception as e:
                print(f"❌ 模板 {template.id} 修复出错: {e}")

        print(f"\n=== 修复完成 ===")
        print(f"总计: {len(templates)} 个模板")
        print(f"成功: {success_count} 个模板")
        print(f"失败: {len(templates) - success_count} 个模板")

if __name__ == "__main__":
    asyncio.run(main())