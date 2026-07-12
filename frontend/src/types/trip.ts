export enum TripStatus {
  DRAFT = 'DRAFT',
  DISPATCHED = 'DISPATCHED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export interface Trip {
  id: string;
  trip_number: string;
  source: string;
  destination: string;
  vehicle_id: string;
  driver_id: string;
  cargo_weight: number;
  planned_distance: number;
  start_odometer?: number;
  final_odometer?: number;
  fuel_consumed?: number;
  revenue: number;
  status: TripStatus;
  created_by: string;
  dispatched_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  created_at: string;
  updated_at: string;
}

export interface TripCreate {
  source: string;
  destination: string;
  vehicle_id: string;
  driver_id: string;
  cargo_weight: number;
  planned_distance: number;
  revenue?: number;
}

export type TripUpdate = Partial<Omit<TripCreate, 'revenue'>> & { revenue?: number };

export interface TripCompleteInput {
  final_odometer: number;
  fuel_consumed: number;
}