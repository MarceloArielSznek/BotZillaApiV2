export interface PagedResponse<T> {
    success: boolean;
    data: T[];
    pagination: {
        totalItems: number;
        totalPages: number;
        currentPage: number;
    };
}

