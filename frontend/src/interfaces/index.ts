export interface Branch {
    id: number;
    name: string;
}

export interface Estimate {
    id: number;
    name: string;
    at_updated_date: string;
    status: {
        name: string;
    };
}

export interface SalesPerson {
    id: number;
    name: string;
    phone?: string;
    telegram_id?: string;
    warning_count: number;
    activeLeadsCount: number;
    branches: Branch[];
    is_active: boolean;
}

// Interfaces para el servicio
export interface SalesPersonListParams {
  page?: number;
  limit?: number;
  search?: string;
  branchId?: number;
  include_inactive?: boolean;
}

export interface SalesPersonListResponse {
  salespersons: SalesPerson[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
  };
}

export interface UpdateSalesPersonData {
  name: string;
  phone?: string;
  telegram_id?: string;
}

export interface CreateSalesPersonData extends UpdateSalesPersonData {
  branchIds: number[];
}

export interface CrewMember {
  id: number;
  name: string;
  phone?: string;
  telegram_id?: string;
  is_leader: boolean;
}

// Job Interfaces
export interface Job {
    id: number;
    name: string;
    closing_date: string;
    estimate: {
        id: number;
        name: string;
        salesperson: {
            id: number;
            name: string;
        };
    };
    branch: {
        id: number;
        name: string;
    };
    crewLeader: {
        id: number;
        name: string;
    };
}

export interface ShiftDetail {
    hours: string;
    crewMember: {
        id: number;
        name: string;
    };
}

export interface SpecialShiftDetail {
    hours: string;
    specialShift: {
        id: number;
        name: string;
    };
}

export interface JobDetails extends Job {
    shifts: ShiftDetail[];
    jobSpecialShifts: SpecialShiftDetail[];
    note?: string;
    attic_tech_hours?: string;
    crew_leader_hours?: string;
    estimate_id?: number;
} 