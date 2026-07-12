export type UserRole =
  | "ADMIN"
  | "FLEET_MANAGER"
  | "DISPATCHER"
  | "SAFETY_OFFICER"
  | "FINANCIAL_ANALYST";

export interface UserRead {
  id: string;
  email: string;
  full_name: string;
  roles: UserRole[];
  is_active: boolean;
  is_superuser: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserCreate {
  email: string;
  password?: string;
  full_name: string;
  roles: UserRole[];
}

export interface AdminUserUpdate {
  email?: string;
  full_name?: string;
}

export interface UserRolesAdd {
  roles: UserRole[];
}

export interface UserFilters {
  skip?: number;
  limit?: number;
  role?: UserRole | "";
  is_active?: boolean | "";
  search?: string;
}
