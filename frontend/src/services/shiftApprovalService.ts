import { api } from '../config/api';

export interface CrewMember {
  id: number;
  name: string;
  is_leader: boolean;
}

export interface Branch {
  id: number;
  name: string;
}

export interface Estimate {
  id: number;
  name: string;
  customer_name: string;
}

export interface Job {
  id: number;
  name: string;
  branch: Branch;
  estimate: Estimate;
  closing_date: string;
}

export interface PendingShift {
  crew_member_id: number;
  job_id: number;
  hours: number;
  crewMember: CrewMember;
  approved_shift: boolean;
  type: 'regular';
}

export interface PendingSpecialShift {
  special_shift_id: number;
  job_id: number;
  hours: number;
  specialShift: {
    id: number;
    name: string;
  };
  approved_shift: boolean;
  type: 'special';
}

export interface JobWithPendingShifts {
  job: Job;
  shifts: PendingShift[];
  specialShifts: PendingSpecialShift[];
}

export interface PendingShiftsResponse {
  success: boolean;
  data: JobWithPendingShifts[];
  total: number;
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface ShiftApprovalStats {
  success: boolean;
  totalPendingShifts: number;
  totalPendingHours: number;
  byBranch: {
    branchId: number;
    branchName: string;
    pendingShifts: number;
    totalHours: number;
  }[];
}

export interface ApprovalResponse {
  success: boolean;
  message: string;
  approvedCount?: number;
  rejectedCount?: number;
}

const shiftApprovalService = {
  // Obtener shifts pendientes de aprobación
  getPendingShifts: async (params?: {
    branch_id?: number;
    limit?: number;
    offset?: number;
  }): Promise<PendingShiftsResponse> => {
    try {
      const queryParams = new URLSearchParams();
      
      if (params?.branch_id) {
        queryParams.append('branch_id', params.branch_id.toString());
      }
      if (params?.limit) {
        queryParams.append('limit', params.limit.toString());
      }
      if (params?.offset) {
        queryParams.append('offset', params.offset.toString());
      }

      const response = await api.get(`/shift-approval/pending?${queryParams.toString()}`);
      
      // Manejo defensivo
      if (!response?.data) {
        return {
          success: false,
          data: [],
          total: 0,
          pagination: { limit: 50, offset: 0, hasMore: false }
        };
      }

      return response.data;
    } catch (error: any) {
      console.error('Error fetching pending shifts:', error.response?.data || error.message);
      return {
        success: false,
        data: [],
        total: 0,
        pagination: { limit: 50, offset: 0, hasMore: false }
      };
    }
  },

  // Obtener estadísticas de shifts pendientes
  getStats: async (): Promise<ShiftApprovalStats> => {
    try {
      const response = await api.get('/shift-approval/stats');
      
      if (!response?.data) {
        return {
          success: false,
          totalPendingShifts: 0,
          totalPendingHours: 0,
          byBranch: []
        };
      }

      return response.data;
    } catch (error: any) {
      console.error('Error fetching shift approval stats:', error.response?.data || error.message);
      return {
        success: false,
        totalPendingShifts: 0,
        totalPendingHours: 0,
        byBranch: []
      };
    }
  },

  // Aprobar shifts específicos
  approveShifts: async (
    shifts: { crew_member_id: number; job_id: number }[], 
    specialShifts: { special_shift_id: number; job_id: number }[] = []
  ): Promise<ApprovalResponse> => {
    try {
      if ((!shifts || shifts.length === 0) && (!specialShifts || specialShifts.length === 0)) {
        throw new Error('No shifts provided');
      }

      const response = await api.post('/shift-approval/approve', {
        shifts: shifts || [],
        specialShifts: specialShifts || []
      });

      return response.data;
    } catch (error: any) {
      console.error('Error approving shifts:', error.response?.data || error.message);
      throw error;
    }
  },

  // Rechazar shifts específicos
  rejectShifts: async (
    shifts: { crew_member_id: number; job_id: number }[], 
    specialShifts: { special_shift_id: number; job_id: number }[] = []
  ): Promise<ApprovalResponse> => {
    try {
      if ((!shifts || shifts.length === 0) && (!specialShifts || specialShifts.length === 0)) {
        throw new Error('No shifts provided');
      }

      const response = await api.post('/shift-approval/reject', {
        shifts: shifts || [],
        specialShifts: specialShifts || []
      });

      return response.data;
    } catch (error: any) {
      console.error('Error rejecting shifts:', error.response?.data || error.message);
      throw error;
    }
  },

  // Aprobar todos los shifts de un job
  approveAllShiftsForJob: async (
    jobId: number, 
    shifts: { crew_member_id: number; job_id: number }[], 
    specialShifts: { special_shift_id: number; job_id: number }[] = []
  ): Promise<ApprovalResponse> => {
    try {
      return await shiftApprovalService.approveShifts(shifts, specialShifts);
    } catch (error) {
      throw error;
    }
  },

  // Rechazar todos los shifts de un job
  rejectAllShiftsForJob: async (
    jobId: number, 
    shifts: { crew_member_id: number; job_id: number }[], 
    specialShifts: { special_shift_id: number; job_id: number }[] = []
  ): Promise<ApprovalResponse> => {
    try {
      return await shiftApprovalService.rejectShifts(shifts, specialShifts);
    } catch (error) {
      throw error;
    }
  }
};

export default shiftApprovalService;
