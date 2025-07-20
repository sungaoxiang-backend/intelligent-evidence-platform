from typing import Annotated, Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import pwd_context
from app.db.session import get_db
from app.models.staff import Staff
from app.schemas.token import TokenPayload

# OAuth2密码Bearer流程
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/login/access-token")

# 数据库会话依赖
DBSession = Annotated[AsyncSession, Depends(get_db)]


async def get_current_staff(
    db: DBSession,
    token: str = Depends(oauth2_scheme),
) -> "Staff":
    """获取当前登录的员工"""
    try:
        # 解码JWT令牌
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
    except (JWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无法验证凭据",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 从数据库获取员工信息
    staff = await db.get(Staff, token_data.sub)
    if not staff:
        raise HTTPException(status_code=404, detail="用户不存在")
    if not staff.is_active:
        raise HTTPException(status_code=400, detail="用户未激活")
    return staff


async def get_current_active_superuser(
    current_staff: Annotated["Staff", Depends(get_current_staff)],
) -> "Staff":
    """获取当前登录的超级管理员"""
    if not current_staff.is_superuser:
        raise HTTPException(
            status_code=400, detail="用户没有足够的权限"
        )
    return current_staff