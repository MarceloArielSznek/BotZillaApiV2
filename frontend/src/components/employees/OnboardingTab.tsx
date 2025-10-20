import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Button, CircularProgress, Alert, Paper, Card, CardContent,
    CardActions, Chip
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EmailIcon from '@mui/icons-material/Email';
import BusinessIcon from '@mui/icons-material/Business';
import BadgeIcon from '@mui/icons-material/Badge';
import employeeService, { Employee } from '@/services/employeeService';
import telegramGroupService, { TelegramGroup } from '@/services/telegramGroupService';
import branchService from '@/services/branchService';
import ActivateEmployeeModal from './ActivateEmployeeModal';
import OnboardingDashboard from './OnboardingDashboard';
import AwaitingRegistrationTable from './AwaitingRegistrationTable';

interface OnboardingTabProps {
    active: boolean;
}

const OnboardingTab: React.FC<OnboardingTabProps> = ({ active }) => {
    const [pendingEmployees, setPendingEmployees] = useState<Employee[]>([]);
    const [allGroups, setAllGroups] = useState<TelegramGroup[]>([]);
    const [allBranches, setAllBranches] = useState<Array<{ id: number; name: string }>>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [activateModalOpen, setActivateModalOpen] = useState(false);
    const [employeeToActivate, setEmployeeToActivate] = useState<Employee | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Cargar empleados primero
            const employeesRes = await employeeService.getPending();
            // Array vacío es válido (sin empleados pendientes)
            setPendingEmployees(Array.isArray(employeesRes) ? employeesRes : []);

            // 2. Cargar grupos después
            try {
                const groupsRes = await telegramGroupService.getAll({ limit: 1000 });
                if (groupsRes && groupsRes.data && Array.isArray(groupsRes.data)) {
                    setAllGroups(groupsRes.data);
                } else {
                    setAllGroups([]);
                    console.warn('Telegram groups response is invalid, using empty array');
                }
            } catch (groupError) {
                console.error('Failed to load Telegram groups:', groupError);
                setAllGroups([]);
            }

            // 3. Cargar branches
            try {
                const branchesRes = await branchService.getBranches({ limit: 1000 });
                if (branchesRes && branchesRes.branches && Array.isArray(branchesRes.branches)) {
                    setAllBranches(branchesRes.branches);
                } else {
                    setAllBranches([]);
                    console.warn('Branches response is invalid, using empty array');
                }
            } catch (branchError) {
                console.error('Failed to load branches:', branchError);
                setAllBranches([]);
            }

        } catch (err) {
            console.error('Failed to load pending employees:', err);
            setError('Failed to load employee data. Please try again.');
            setPendingEmployees([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Cargar los datos solo cuando la pestaña está activa
        if (active) {
            loadData();
        }
    }, [active, loadData]);

    const handleOpenActivateModal = (employee: Employee) => {
        setEmployeeToActivate(employee);
        setActivateModalOpen(true);
    };

    const handleCloseActivateModal = () => {
        setActivateModalOpen(false);
        setEmployeeToActivate(null);
    };

    const handleActivateEmployee = async (data: {
        final_role: 'crew_member' | 'crew_leader' | 'sales_person' | 'corporate';
        branches: number[];
        is_leader?: boolean;
        animal?: string;
        telegram_groups: number[];
        user_role_id?: number;
    }) => {
        if (!employeeToActivate) return;

        try {
            const response = await employeeService.activate(employeeToActivate.id, data);
            setSuccess(response.message || 'Employee activated successfully!');
            // Remover al empleado de la lista de pendientes
            setPendingEmployees(prev => prev.filter(e => e.id !== employeeToActivate.id));
            handleCloseActivateModal();
        } catch (err: any) {
            // El error se maneja en el modal
            throw err;
        }
    };

    const getRoleColor = (role: string): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
        switch (role) {
            case 'crew_leader':
                return 'primary';
            case 'crew_member':
                return 'info';
            case 'salesperson':
                return 'secondary';
            case 'corporate':
                return 'warning';
            default:
                return 'default';
        }
    };

    const formatRole = (role: string): string => {
        return role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    return (
        <Box>
            {/* Dashboard de estadísticas y sincronización */}
            <OnboardingDashboard onSyncComplete={loadData} />

            <Paper sx={{ p: 3, mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box>
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                            Pending Employees Onboarding
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Review and activate new employee registrations
                        </Typography>
                    </Box>
                    {!loading && pendingEmployees.length > 0 && (
                        <Chip 
                            label={`${pendingEmployees.length} pending`} 
                            color="warning" 
                            size="small" 
                        />
                    )}
                </Box>

                {loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress />
                    </Box>
                )}

                {success && (
                    <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
                        {success}
                    </Alert>
                )}

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                        {error}
                    </Alert>
                )}

                {!loading && pendingEmployees.length === 0 && (
                    <Alert severity="info">
                        No pending employees to onboard.
                    </Alert>
                )}

                {!loading && pendingEmployees.length > 0 && (
                    <Box 
                        sx={{ 
                            display: 'grid',
                            gridTemplateColumns: {
                                xs: '1fr',
                                sm: 'repeat(2, 1fr)',
                                md: 'repeat(3, 1fr)'
                            },
                            gap: 2
                        }}
                    >
                        {pendingEmployees.map((employee) => (
                            <Card 
                                key={employee.id}
                                sx={{ 
                                    display: 'flex',
                                    flexDirection: 'column',
                                    '&:hover': {
                                        boxShadow: 4,
                                        transform: 'translateY(-2px)',
                                        transition: 'all 0.2s ease-in-out'
                                    }
                                }}
                            >
                                <CardContent sx={{ flexGrow: 1 }}>
                                    {/* Name and Role */}
                                    <Box sx={{ mb: 2 }}>
                                        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                                            {employee.first_name} {employee.last_name}
                                        </Typography>
                                        <Chip 
                                            label={formatRole(employee.role)}
                                            color={getRoleColor(employee.role)}
                                            size="small"
                                        />
                                    </Box>

                                    {/* Employee Info */}
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <EmailIcon fontSize="small" color="action" />
                                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                                                {employee.email}
                                            </Typography>
                                        </Box>

                                        {employee.branch && (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <BusinessIcon fontSize="small" color="action" />
                                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                                                    {employee.branch.name}
                                                </Typography>
                                            </Box>
                                        )}

                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <BadgeIcon fontSize="small" color="action" />
                                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                                                ID: {employee.id}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </CardContent>

                                <CardActions sx={{ p: 2, pt: 0 }}>
                                    <Button 
                                        fullWidth
                                        variant="contained" 
                                        color="success"
                                        onClick={() => handleOpenActivateModal(employee)} 
                                        startIcon={<CheckCircleIcon />}
                                    >
                                        Activate Employee
                                    </Button>
                                </CardActions>
                            </Card>
                        ))}
                    </Box>
                )}
            </Paper>

            {/* Tabla de empleados esperando completar su registro */}
            <AwaitingRegistrationTable active={active} />

            {/* Activate Employee Modal */}
            <ActivateEmployeeModal
                open={activateModalOpen}
                employee={employeeToActivate}
                allBranches={allBranches}
                allGroups={allGroups}
                onClose={handleCloseActivateModal}
                onConfirm={handleActivateEmployee}
            />
        </Box>
    );
};

export default OnboardingTab;
