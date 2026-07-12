from pydantic import BaseModel, Field


class AnalyticsSummary(BaseModel):
    """Aggregated operational and financial analytics."""

    total_fuel_cost: float = Field(
        ...,
        ge=0,
        description="Total cost from fuel logs.",
    )
    total_maintenance_cost: float = Field(
        ...,
        ge=0,
        description="Total maintenance cost.",
    )
    total_operational_cost: float = Field(
        ...,
        ge=0,
        description="Fuel cost plus maintenance cost.",
    )
    total_other_expenses: float = Field(
        ...,
        ge=0,
        description="Total amount from other expense records.",
    )
    total_revenue: float = Field(
        ...,
        ge=0,
        description="Total revenue from completed trips.",
    )
    total_distance: float = Field(
        ...,
        ge=0,
        description="Total distance travelled by completed trips.",
    )
    total_fuel_consumed: float = Field(
        ...,
        ge=0,
        description="Total fuel consumed by completed trips.",
    )
    fuel_efficiency: float = Field(
        ...,
        ge=0,
        description="Total distance divided by total fuel consumed.",
    )
    fleet_utilization: float = Field(
        ...,
        ge=0,
        le=100,
        description="Percentage of non-retired vehicles currently on trip.",
    )
    vehicle_roi: float = Field(
        ...,
        description="Fleet ROI percentage based on revenue, fuel, maintenance, and acquisition cost.",
    )
