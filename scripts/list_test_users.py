#!/usr/bin/env python3
"""
列出生产数据库中的测试用户数据（仅查看）
"""
import asyncio
import sys
from pathlib import Path

# 添加项目根目录到路径
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select as sql_select
from app.core.config import settings
from app.users.models import User


async def list_test_users():
    """列出测试用户数据"""
    
    engine = create_async_engine(str(settings.SQLALCHEMY_DATABASE_URI))
    async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    
    async with async_session() as session:
        # 查找测试用户
        test_patterns = [
            "%test_user%",
            "%占位符%",
            "%测试%",
            "%导出用户%",
        ]
        
        all_suspicious = []
        
        for pattern in test_patterns:
            stmt = sql_select(User).where(User.name.like(pattern))
            result = await session.execute(stmt)
            users = result.scalars().all()
            
            for user in users:
                if user.id not in [u.id for u in all_suspicious]:
                    all_suspicious.append(user)
        
        if all_suspicious:
            print(f"\n找到 {len(all_suspicious)} 个可疑的测试用户:")
            print(f"{'ID':<10} {'姓名':<40} {'手机号':<20} {'创建时间'}")
            print("="*100)
            for user in all_suspicious:
                print(f"{user.id:<10} {user.name:<40} {user.phone:<20} {str(user.created_at)[:19]}")
            print("\n")
            print(f"总计: {len(all_suspicious)} 个用户")
        else:
            print("\n✅ 未找到可疑的测试用户")
    
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(list_test_users())

