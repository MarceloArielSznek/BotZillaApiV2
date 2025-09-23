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
};

export default onboardingService;
