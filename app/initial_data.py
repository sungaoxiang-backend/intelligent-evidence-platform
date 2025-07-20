import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.db.session import engine, Base, SessionLocal
from app.core.security import get_password_hash
from app.models.staff import Staff
from app.core.config import settings


async def create_first_superuser():
    """创建第一个超级管理员账户"""
    async with SessionLocal() as db:
        # 检查是否已存在超级管理员
        result = await db.execute(text("SELECT id FROM staffs WHERE is_superuser = true"))
        superuser = result.first()

        if not superuser:
            # 创建超级管理员
            superuser = Staff(
                username=settings.FIRST_SUPERUSER_USERNAME,
                email=settings.FIRST_SUPERUSER_EMAIL,
                hashed_password=get_password_hash(settings.FIRST_SUPERUSER_PASSWORD),
                full_name="超级管理员",
                is_superuser=True,
                is_active=True,
            )
            db.add(superuser)
            await db.commit()
            print("超级管理员创建成功！")
        else:
            print("超级管理员已存在，跳过创建。")


if __name__ == "__main__":
    asyncio.run(create_first_superuser())