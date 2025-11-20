#!/usr/bin/env python3
"""
使用原生 SQL 列出生产数据库中的测试用户数据（避免 ORM 导入冲突）
"""
import asyncio
import sys
from pathlib import Path

# 添加项目根目录到路径
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings


async def list_test_users():
    """列出测试用户数据"""
    
    engine = create_async_engine(str(settings.SQLALCHEMY_DATABASE_URI))
    
    async with engine.begin() as conn:
        # 使用原生 SQL 查询测试用户
        query = text("""
            SELECT id, name, phone, created_at
            FROM users
            WHERE name LIKE :pattern1
               OR name LIKE :pattern2
               OR name LIKE :pattern3
               OR name LIKE :pattern4
            ORDER BY created_at DESC
        """)
        
        result = await conn.execute(
            query,
            {
                "pattern1": "%test_user%",
                "pattern2": "%占位符%",
                "pattern3": "%测试%",
                "pattern4": "%导出用户%",
            }
        )
        
        users = result.fetchall()
        
        if users:
            print(f"\n找到 {len(users)} 个可疑的测试用户:")
            print(f"{'ID':<10} {'姓名':<40} {'手机号':<20} {'创建时间'}")
            print("="*100)
            for user in users:
                print(f"{user.id:<10} {user.name:<40} {user.phone or 'N/A':<20} {str(user.created_at)[:19]}")
            print("\n")
            print(f"总计: {len(users)} 个用户")
            print("\n⚠️  这些用户是通过测试代码意外写入生产数据库的")
            print("💡 可以使用 SQL 手动删除，或联系管理员清理")
        else:
            print("\n✅ 未找到可疑的测试用户")
    
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(list_test_users())

