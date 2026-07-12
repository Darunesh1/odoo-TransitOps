from pydantic import BaseModel, Field


class DashboardKPIs(BaseModel):
    """Schema representing dashboard Key Performance Indicators."""

    active_vehicles: int = Field(..., description="Number of vehicles not RETIRED.")
    available_vehicles: int = Field(..., description="Number of vehicles with status AVAILABLE.")
    vehicles_in_maintenance: int = Field(..., description="Number of vehicles with status IN_SHOP.")
    active_trips: int = Field(..., description="Number of trips with status DISPATCHED.")
    pending_trips: int = Field(..., description="Number of trips with status DRAFT.")
    drivers_on_duty: int = Field(..., description="Number of drivers with status ON_TRIP.")
    fleet_utilization: float = Field(..., description="Percentage of active vehicles currently on a trip.")
