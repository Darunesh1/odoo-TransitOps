export interface DashboardKPIs {
  active_vehicles: number;
  available_vehicles: number;
  vehicles_in_maintenance: number;
  active_trips: number;
  pending_trips: number;
  drivers_on_duty: number;
  fleet_utilization: number;
}

export interface DashboardFilters {
  vehicle_type?: string;
  vehicle_status?: string;
  region?: string;
}
