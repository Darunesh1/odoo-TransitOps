import asyncio
from typing import AsyncGenerator, Generator
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.database import Base
from app.main import app as fastapi_app
from app.core.config import settings

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool
import app.core.database

# Override the database engine and session maker with NullPool to prevent connection reuse across pytest loops.
app.core.database.engine = create_async_engine(
    settings.async_database_url,
    poolclass=NullPool,
    future=True,
)
app.core.database.async_session_maker = async_sessionmaker(
    app.core.database.engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@pytest.fixture(autouse=True)
async def setup_test_db() -> None:
    """Creates database tables and seeds system roles before each test function to guarantee isolation."""
    # Ensure tables are dropped and recreated
    async with app.core.database.engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    # Seed roles
    from app.models.role import Role
    from app.models.user import UserRole
    async with app.core.database.async_session_maker() as session:
        for r_enum in UserRole:
            new_role = Role(name=r_enum.value, description=f"System role for {r_enum.value}")
            session.add(new_role)
        await session.commit()


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Yields a fresh AsyncSession. setup_test_db handles cleanup/re-creation before each test."""
    async with app.core.database.async_session_maker() as session:
        yield session


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Yields a test client connected to the FastAPI application."""
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def mock_emails(monkeypatch):
    """Mocks Celery delay methods for email tasks to check if they were called."""
    from app.tasks.email_tasks import send_verification_email, send_welcome_email

    calls = {"verification_emails": [], "welcome_emails": []}

    def mock_verification_delay(*args, **kwargs):
        calls["verification_emails"].append((args, kwargs))
        return None

    def mock_welcome_delay(*args, **kwargs):
        calls["welcome_emails"].append((args, kwargs))
        return None

    monkeypatch.setattr(send_verification_email, "delay", mock_verification_delay)
    monkeypatch.setattr(send_welcome_email, "delay", mock_welcome_delay)

    return calls
