import { api } from '../config/api';
import type { Job, JobDetails } from '../interfaces';

interface JobFilters {
    page?: number;
    limit?: number;
    search?: string;
    branchId?: string;
    salespersonId?: string;
    crewLeaderId?: string;
    startDate?: string;
    endDate?: string;
}

export interface JobsResponse {
    data: Job[];
    pagination: {
        total: number;
        pages: number;
        currentPage: number;
    };
}

export const getJobs = async (filters: JobFilters = {}): Promise<JobsResponse> => {
    const params = new URLSearchParams();
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.search) params.append('search', filters.search);
    if (filters.branchId) params.append('branchId', filters.branchId);
    if (filters.salespersonId) params.append('salespersonId', filters.salespersonId);
    if (filters.crewLeaderId) params.append('crewLeaderId', filters.crewLeaderId);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    const response = await api.get('/jobs', { params });
    return response.data;
};

export const getJobById = async (id: number): Promise<JobDetails> => {
    const response = await api.get(`/jobs/${id}`);
    return response.data.data;
};

export type CreateJobData = {
    name: string;
    closing_date?: string;
    estimate_id?: number;
    crew_leader_id?: number;
    branch_id: number;
    note?: string;
    review?: number;
};

export type UpdateJobData = Partial<CreateJobData>;

export const createJob = async (jobData: CreateJobData): Promise<Job> => {
    const response = await api.post('/jobs', jobData);
    return response.data.data;
};

export const updateJob = async (id: number, jobData: UpdateJobData): Promise<Job> => {
    const response = await api.put(`/jobs/${id}`, jobData);
    return response.data.data;
};

export interface ShiftData {
    crew_member_id?: number;
    special_shift_id?: number;
    hours: number;
    is_leader?: boolean;
}

export interface PerformanceData {
    atHours: number;
    clPlanHours: number;
    totalWorkedHours: number;
    totalSavedHours: number;
    jobBonusPool: number;
    plannedToSavePercent: number;
    potentialBonusPool: number;
    actualSavedPercent: number;
}

export const addOrUpdateShifts = async (id: number, shifts: { regularShifts: ShiftData[], specialShifts: ShiftData[] }): Promise<void> => {
    await api.post(`/jobs/${id}/shifts`, shifts);
};

export const getJobPerformance = async (id: number): Promise<PerformanceData> => {
    const response = await api.get(`/jobs/${id}/performance`);
    return response.data.data;
};

export const deleteJob = async (id: number): Promise<void> => {
    await api.delete(`/jobs/${id}`);
}; 