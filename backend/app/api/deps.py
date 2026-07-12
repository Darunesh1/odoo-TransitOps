from typing import AsyncGenerator
import uuid
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User, UserRole
from app.schemas.token import TokenPayload


# OAuth2 scheme config (points to our relative login route path)
reusable_oauth2 = OAuth2PasswordBearer(tokenUrl="auth/login")


async def get_current_user(
    db: AsyncSession = Depends(get_db), token: str = Depends(reusable_oauth2)
) -> User:
    """FastAPI dependency to retrieve, validate, and authorize the current user based on the JWT token."""
    payload_dict = decode_token(token)
    if not payload_dict:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        token_data = TokenPayload(**payload_dict)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if token_data.type != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type, access token required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Convert token subject (user ID) back to UUID
    try:
        user_uuid = uuid.UUID(token_data.sub)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token subject must be a valid UUID",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Fetch user from the database
    query = select(User).where(User.id == user_uuid)
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_440_LOGIN_TIME_OUT,  # Or standard 404
            detail="User associated with this token not found",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is inactive",
        )

    return user


def get_current_active_superuser(
    current_user: User = Depends(get_current_user),
) -> User:
    """FastAPI dependency to verify that the logged-in user is a superuser."""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user does not have enough privileges",
        )
    return current_user


def require_roles(*roles: UserRole):
    """FastAPI dependency factory to restrict endpoint access by roles."""
    async def role_dependency(
        current_user: User = Depends(get_current_user),
    ) -> User:
        if current_user.is_superuser or current_user.role in roles:
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user does not have enough privileges",
        )
    return role_dependency

