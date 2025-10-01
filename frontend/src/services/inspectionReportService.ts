import { api } from '../config/api';
import { PagedResponse } from '../interfaces/PagedResponse';

// Define la interfaz para un único reporte de inspección
export interface InspectionReport {
    id: number;
    estimate_name: string;
    branch_name: string;
    salesperson_name: string;
    salesperson_email: string;
    client_name: string;
    client_phone: string;
    client_email: string;
    client_address: string;
    estimate_link: string;
    roof_condition: string;
    system_condition: string;
    full_roof_inspection_interest: boolean;
    full_hvac_furnace_inspection_interest: boolean;
    roof_notification_sent: boolean;
    hvac_notification_sent: boolean;
    attic_tech_created_at: string;
    created_at: string;
    updated_at: string;
    is_lead: boolean;
    is_opportunity: boolean;
    status: 'Lead' | 'Opportunity' | 'Lead & Opportunity' | 'Report';
    service_type: 'Roofing' | 'HVAC' | 'Both' | '-';
}

// Define los parámetros que se pueden enviar al endpoint
export interface GetInspectionReportsParams {
    page?: number;
    limit?: number;
    branch_name?: string;
    salesperson_name?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    sort?: string;
    order?: 'ASC' | 'DESC';
    type?: string;
    service_type?: string;
}

export interface InspectionReportsStats {
    overall: {
        totalReports: number;
        totalLeads: number;
        roofingLeads: number;
        hvacLeads: number;
        roofNotificationsSent: number;
        hvacNotificationsSent: number;
        totalOpportunities: number;
        roofOpportunities: number;
        hvacOpportunities: number;
        overallConversionRate: string;
    };
    byBranch: {
        branch: string;
        total: number;
        leads: number;
        roofingLeads: number;
        hvacLeads: number;
        opportunities: number;
        conversionRate: string;
    }[];
}

const inspectionReportService = {
    getAll: async (page = 1, limit = 10, filters: GetInspectionReportsParams = {}) => {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
        });
        
        // Add filters
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                params.append(key, value.toString());
            }
        });
        
        const response = await api.get(`/inspection-reports?${params.toString()}`);
        return response.data;
    },

    getStats: async (filters: { startDate?: string; endDate?: string; branch_name?: string } = {}) => {
        const params = new URLSearchParams();
        
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                params.append(key, value.toString());
            }
        });
        
        const response = await api.get(`/inspection-reports/stats?${params.toString()}`);
        return response.data;
    },
};

export default inspectionReportService;
