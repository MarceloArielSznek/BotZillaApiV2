import { api } from '../config/api';
import type { Job, JobDetails } from '../interfaces';

interface JobFilters {
    branchId?: string;
    salespersonId?: string;
    crewLeaderId?: string;
    startDate?: string;
    endDate?: string;
}

export const getJobs = async (filters: JobFilters = {}): Promise<Job[]> => {
    const params = new URLSearchParams();
    if (filters.branchId) params.append('branchId', filters.branchId);
    if (filters.salespersonId) params.append('salespersonId', filters.salespersonId);
    if (filters.crewLeaderId) params.append('crewLeaderId', filters.crewLeaderId);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    const response = await api.get('/jobs', { params });
    return response.data.data;
};

export const getJobById = async (id: number): Promise<JobDetails> => {
    const response = await api.get(`/jobs/${id}`);
    return response.data.data;
};

export const deleteJob = async (id: number): Promise<void> => {
    await api.delete(`/jobs/${id}`);
}; 