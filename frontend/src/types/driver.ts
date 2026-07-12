export enum DriverStatus {
  AVAILABLE = 'Available',
  ON_TRIP = 'On Trip',
  OFF_DUTY = 'Off Duty',
  SUSPENDED = 'Suspended',
}

export interface Driver {
  id: string;
  name: string;
  license_number: string;
  license_category: string; // e.g., LMV, HMV
  license_expiry: string;   // ISO date string
  contact: string;
  safety_score: number;     // 0–100
  trip_compliance?: number; 
  status: DriverStatus;
}

export interface DriverCreate {
  name: string;
  license_number: string;
  license_category: string;
  license_expiry: string;
  contact: string;
  safety_score?: number;
  status?: DriverStatus;
}

export type DriverUpdate = Partial<DriverCreate>;