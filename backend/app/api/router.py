from fastapi import APIRouter

from app.api.endpoints import auth, users

api_router = APIRouter()

# Include endpoint routes from submodules
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
