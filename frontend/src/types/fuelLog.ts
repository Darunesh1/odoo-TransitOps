export interface FuelLog {
  id: string;
  vehicle_id: string;
  trip_id?: string;
  liters: number;
  cost: number;
  date: string; // YYYY-MM-DD
  odometer?: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface FuelLogCreate {
  vehicle_id: string;
  trip_id?: string;
  liters: number;
  cost: number;
  date: string; // YYYY-MM-DD
  odometer?: number;
}

export type FuelLogUpdate = Partial<FuelLogCreate>;