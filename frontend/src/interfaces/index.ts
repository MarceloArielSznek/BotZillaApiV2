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
}

// Interfaces para el servicio
export interface SalesPersonListParams {
  page?: number;
  limit?: number;
  search?: string;
  branchId?: number;
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