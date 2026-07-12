export enum MaintenanceStatus {
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export interface MaintenanceRecord {
  id: string;
  vehicle_id: string;
  maintenance_type: string;
  description?: string | null;
  cost: number;
  status: MaintenanceStatus;
  started_at: string;
  completed_at?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceCreateInput {
  vehicle_id: string;
  maintenance_type: string;
  description?: string;
  cost?: number;
  started_at?: string;
}

export interface MaintenanceUpdateInput {
  maintenance_type?: string;
  description?: string;
  cost?: number;
  started_at?: string;
}

export interface MaintenanceFilters {
  vehicle_id?: string;
  status?: MaintenanceStatus | "";
  maintenance_type?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
  skip?: number;
  limit?: number;
}

export type Maintenance = MaintenanceRecord;
export type MaintenanceCreate = MaintenanceCreateInput;
export type MaintenanceUpdate = MaintenanceUpdateInput;
