from fastapi import APIRouter

from app.api.endpoints import auth, users, vehicles, drivers, trips, maintenance, fuel_logs, expenses

api_router = APIRouter()

# Include endpoint routes from submodules
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(vehicles.router, prefix="/vehicles", tags=["Vehicles"])
api_router.include_router(drivers.router, prefix="/drivers", tags=["Drivers"])
api_router.include_router(trips.router, prefix="/trips", tags=["Trips"])
api_router.include_router(maintenance.router, prefix="/maintenance", tags=["Maintenance"])
api_router.include_router(fuel_logs.router, prefix="/fuel-logs", tags=["Fuel Logs"])
api_router.include_router(expenses.router, prefix="/expenses", tags=["Expenses"])





