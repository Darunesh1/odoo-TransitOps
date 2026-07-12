export enum VehicleStatus {
  AVAILABLE = 'Available',
  ON_TRIP = 'On Trip',
  IN_SHOP = 'In Shop',
  RETIRED = 'Retired',
}

export interface Vehicle {
  id: string;
  registration_number: string;
  name: string;
  model: string;
  type: string;
  capacity: string;
  domestic: number;
  acquisition_cost: number;
  status: VehicleStatus;
}

export interface VehicleCreate {
  registration_number: string;
  name: string;
  model?: string;
  type: string;
  capacity: string;
  domestic?: number;
  acquisition_cost: number;
  status?: VehicleStatus;
}

export type VehicleUpdate = Partial<VehicleCreate>;