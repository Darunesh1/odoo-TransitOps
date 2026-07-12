export enum VehicleStatus {
  AVAILABLE = 'AVAILABLE',
  ON_TRIP = 'ON_TRIP',
  IN_SHOP = 'IN_SHOP',
  RETIRED = 'RETIRED',
}

export interface Vehicle {
  id: string;
  registration_number: string;
  name: string;
  model?: string;
  vehicle_type: string;
  max_load_capacity: number;
  odometer: number;
  acquisition_cost: number;
  region?: string;
  status: VehicleStatus;
  created_at?: string;
  updated_at?: string;
}

export interface VehicleCreate {
  registration_number: string;
  name: string;
  model?: string;
  vehicle_type: string;
  max_load_capacity: number;
  acquisition_cost: number;
  region?: string;
}

export type VehicleUpdate = Partial<VehicleCreate>;