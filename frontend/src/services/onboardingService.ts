import { api } from '../config/api';

interface AssignGroupsPayload {
    employee_id: number;
    groups: number[];
}

const onboardingService = {
    assignGroups: async (payload: AssignGroupsPayload): Promise<void> => {
        const response = await api.post('/onboarding/assign-groups', payload);
        return response.data;
    },

    kickFromAllGroups: async (employeeId: number): Promise<void> => {
        const response = await api.post('/onboarding/kick-from-all-groups', { employee_id: employeeId });
        return response.data;
    },
};

export default onboardingService;
