from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.db.base_class import Base

# 创建异步数据库引擎
engine = create_async_engine(
    str(settings.SQLALCHEMY_DATABASE_URI),  # 将 PostgresDsn 对象转换为字符串
    poolclass=NullPool,
    echo=False,  # 设置为True可以查看SQL语句
)

# 创建异步会话工厂
async_session_factory = async_sessionmaker(
    engine, expire_on_commit=False, autoflush=False
)

# 导出 Base 和 SessionLocal 供其他模块使用
SessionLocal = async_session_factory
__all__ = ["Base", "SessionLocal"]

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """获取数据库会话的依赖函数"""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise