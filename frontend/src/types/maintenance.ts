export enum MaintenanceStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export interface Maintenance {
  id: string;
  vehicle_id: string;
  maintenance_type: string;
  description?: string;
  cost: number;
  status: MaintenanceStatus;
  started_at: string;
  completed_at?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  vehicle?: { id: string; name: string; registration_number: string };
}

export interface MaintenanceCreate {
  vehicle_id: string;
  maintenance_type: string;
  description?: string;
  cost?: number;
  started_at?: string; // ISO datetime
}

export type MaintenanceUpdate = Partial<Omit<MaintenanceCreate, 'vehicle_id'>>;