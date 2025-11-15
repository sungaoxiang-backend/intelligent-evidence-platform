"""
pytest 配置和共享 fixtures
"""
import asyncio
from typing import AsyncGenerator

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.core.security import create_access_token, pwd_context
from app.db.base_class import Base
from app.db.session import get_db
from app.main import app
from app.staffs.models import Staff

# 测试数据库 URL（使用内存数据库或单独的测试数据库）
TEST_DATABASE_URL = str(settings.SQLALCHEMY_DATABASE_URI).replace(
    settings.POSTGRES_DB, f"{settings.POSTGRES_DB}_test"
)

# 创建测试数据库引擎
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    poolclass=NullPool,
    echo=False,
)

# 创建测试会话工厂
TestSessionLocal = async_sessionmaker(
    test_engine, expire_on_commit=False, autoflush=False
)


@pytest.fixture(scope="session")
def event_loop():
    """创建事件循环"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def setup_test_db():
    """设置测试数据库"""
    # 创建所有表
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield
    
    # 清理：删除所有表
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def db_session(setup_test_db) -> AsyncGenerator[AsyncSession, None]:
    """创建数据库会话"""
    async with TestSessionLocal() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """创建测试客户端"""
    async def override_get_db():
        yield db_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
    
    app.dependency_overrides.clear()


@pytest.fixture
async def test_staff(db_session: AsyncSession) -> Staff:
    """创建测试员工"""
    staff = Staff(
        username="testuser",
        email="test@example.com",
        hashed_password=pwd_context.hash("testpassword"),
        is_active=True,
        is_superuser=False,
    )
    db_session.add(staff)
    await db_session.commit()
    await db_session.refresh(staff)
    return staff


@pytest.fixture
async def test_superuser(db_session: AsyncSession) -> Staff:
    """创建测试超级管理员"""
    staff = Staff(
        username="admin",
        email="admin@example.com",
        hashed_password=pwd_context.hash("admin123"),
        is_active=True,
        is_superuser=True,
    )
    db_session.add(staff)
    await db_session.commit()
    await db_session.refresh(staff)
    return staff


@pytest.fixture
def auth_headers(test_staff: Staff) -> dict:
    """创建认证头"""
    token = create_access_token(subject=test_staff.id)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def superuser_headers(test_superuser: Staff) -> dict:
    """创建超级管理员认证头"""
    token = create_access_token(subject=test_superuser.id)
    return {"Authorization": f"Bearer {token}"}

