import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import authService from './authService';

export interface EstimatesByStatus {
  id: number;
  name: string;
  count: string;
}

export interface BusinessMetrics {
  estimates: {
    total: number;
    active: number;
    byStatus: EstimatesByStatus[];
    weeklyAverage: number;
  };
  revenue: {
    thisMonth: number;
    lastMonth: number;
    total: number;
    growth: number;
  };
  jobs: {
    thisMonth: number;
    lastMonth: number;
    completedToday: number;
    growth: number;
    recent: Array<{
      id: number;
      name: string;
      branch?: string | null;
      estimator?: string | null;
      crewLeader?: string | null;
      closing_date: string;
      review?: number;
      actualSavedPercent: number;
      jobBonusPool: number;
    }>;
  };
}

export interface SalespersonPerformance {
  id: number;
  name: string;
  warning_count: number;
  activeLeads: string;
  estimatesThisMonth: string;
  revenueThisMonth: string;
}

export interface TeamPerformance {
  salespersons: {
    total: number;
    overLimit: SalespersonPerformance[];
    topPerformers: SalespersonPerformance[];
    all: SalespersonPerformance[];
  };
  crew: {
    total: number;
  };
}

export interface BranchMetrics {
  id: number;
  name: string;
  activeEstimates: string;
  jobsThisMonth: string;
  revenueThisMonth: string;
}

export interface SystemStats {
  totalUsers: number;
  totalBranches: number;
  totalSalespersons: number;
  totalCrewMembers: number;
}

export interface DashboardSummary {
  businessMetrics: BusinessMetrics;
  teamPerformance: TeamPerformance;
  branchMetrics: BranchMetrics[];
  notifications: {
    sentToday: number;
    sentThisWeek: number;
    recentWarnings: Array<{ id: number; message: string; created_at: string; salesPersonRecipient?: { name: string } }>;
  };
  systemStats: SystemStats;
  
  // Legacy fields for backward compatibility
  salespersonsOverLimit: Array<{ id: number; name: string; activeLeadsCount: number }>;
  jobs: {
    closedToday: number;
    items: Array<{ id: number; name: string; branch?: string | null; estimator?: string | null; closing_date: string; actualSavedPercent: number; jobBonusPool: number }>;
    mostProfitableToday: Array<{ id: number; name: string; jobBonusPool: number; closing_date: string }>;
  };
  employees: {
    latestSalespersons: Array<{ id: number; name: string }>;
    latestCrew: Array<{ id: number; name: string; is_leader: boolean }>;
  };
}

const getAuthHeaders = () => ({ headers: { Authorization: `Bearer ${authService.getToken()}` } });

export const getDashboardSummary = async (): Promise<DashboardSummary> => {
  const res = await axios.get(`${API_BASE_URL}/dashboard/summary`, getAuthHeaders());
  return res.data as DashboardSummary;
};

