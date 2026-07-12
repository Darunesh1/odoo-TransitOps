from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.database import init_db

# Configure logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager that runs code on server startup and shutdown."""
    logger.info("Starting up FastAPI application...")
    try:
        # Run database checks and table initialization
        await init_db()
    except Exception as e:
        logger.error(f"Startup database initialization failed: {e}")
        # Terminate startup if database is unavailable
        raise e
    yield
    logger.info("Shutting down FastAPI application...")
    # Dispose the database engine connection pool
    from app.core.database import engine
    await engine.dispose()
    logger.info("Database connection pool closed successfully.")


app = FastAPI(
    title="FastAPI Backend Template",
    description="A robust and reusable backend template featuring FastAPI, PostgreSQL, Redis, and Celery.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware configuration
# In production, specify explicit frontend origins instead of "*"
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include unified API router
app.include_router(api_router)


@app.get("/", tags=["Status"])
async def root():
    """Welcome page / Status endpoint returning application metadata."""
    return {
        "title": app.title,
        "version": app.version,
        "docs_url": "/docs",
        "status": "healthy",
        "watch_sync": "active",
    }
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
