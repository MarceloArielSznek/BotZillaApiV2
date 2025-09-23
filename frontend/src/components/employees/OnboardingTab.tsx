import React, { useState, useEffect } from 'react';
import {
    Box, Typography, FormGroup, FormControlLabel, Checkbox, Button,
    CircularProgress, Alert, Paper, Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import employeeService, { Employee } from '@/services/employeeService';
import telegramGroupService, { TelegramGroup } from '@/services/telegramGroupService';
import onboardingService from '@/services/onboardingService';

// Nueva lógica para obtener grupos por defecto, ahora corregida y más robusta
const getDynamicDefaultGroups = (employee: Employee, allGroups: TelegramGroup[]): Set<number> => {
    // 1. Mapeo explícito de rol de empleado a nombre de categoría de grupo
    const roleToCategoryMap: { [key: string]: string } = {
        salesperson: 'Sales',
        crew_member: 'Crew Members',
        crew_leader: 'Crew Leaders'
    };
    
    const targetCategoryName = roleToCategoryMap[employee.role];
    if (!targetCategoryName) {
        return new Set(); // No hay categoría por defecto para este rol
    }

    // 2. Filtrar los grupos que son "default" Y...
    return new Set(allGroups
        .filter(g => {
            const isDefault = g.is_default;
            // ...coinciden con la categoría del rol
            const categoryMatch = g.category?.name.toLowerCase() === targetCategoryName.toLowerCase();
            // ...y (o son generales o el nombre de su branch coincide con la del empleado)
            const branchMatch = g.branch_id === null || g.branch?.name === employee.branch;
            
            return isDefault && categoryMatch && branchMatch;
        })
        .map(g => g.id)
    );
};

// Helper para agrupar por categoría
const groupByCategory = (groups: TelegramGroup[]) => {
    return groups.reduce((acc, group) => {
        const categoryName = group.category?.name || 'Uncategorized';
        if (!acc[categoryName]) {
            acc[categoryName] = [];
        }
        acc[categoryName].push(group);
        return acc;
    }, {} as Record<string, TelegramGroup[]>);
};

const OnboardingTab = () => {
    const [pendingEmployees, setPendingEmployees] = useState<Employee[]>([]);
    const [allGroups, setAllGroups] = useState<TelegramGroup[]>([]);
    const [selectedGroups, setSelectedGroups] = useState<{ [key: number]: Set<number> }>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [expandedEmployee, setExpandedEmployee] = useState<number | null>(null);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            setError(null);
            try {
                // 1. Cargar empleados primero
                const employeesRes = await employeeService.getPending();
                if (!employeesRes) throw new Error("Could not fetch employees.");
                setPendingEmployees(employeesRes);

                // 2. Cargar grupos después
                try {
                    const groupsRes = await telegramGroupService.getAll(1, 1000);
                    if (!groupsRes || !groupsRes.data) throw new Error("Could not fetch groups.");
                    setAllGroups(groupsRes.data);
                } catch (groupError) {
                    // Si los grupos fallan, mostramos un error específico pero mantenemos la app funcional
                    setError('Failed to load Telegram groups. Management is disabled.');
                }

            } catch (err) {
                setError('Failed to load initial employee data. Please try again.');
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const handleAccordionChange = (employeeId: number) => async (_event: React.SyntheticEvent, isExpanded: boolean) => {
        setExpandedEmployee(isExpanded ? employeeId : null);
        // Cargar los grupos del empleado solo si no se han cargado antes
        if (isExpanded && !selectedGroups[employeeId]) {
            try {
                const assignedGroups = await employeeService.getAssignedGroups(employeeId);
                let groupIds: Set<number>;

                if (assignedGroups.length > 0) {
                    // Si ya tiene grupos, usar esos
                    groupIds = new Set(assignedGroups.map(g => g.id));
                } else {
                    // Si no tiene, calcular los de por defecto
                    const employee = pendingEmployees.find(e => e.id === employeeId);
                    if (employee) {
                        // Usar la nueva lógica dinámica
                        groupIds = getDynamicDefaultGroups(employee, allGroups);
                    } else {
                        groupIds = new Set();
                    }
                }
                setSelectedGroups(prev => ({ ...prev, [employeeId]: groupIds }));
            } catch {
                setError(`Failed to load groups for employee.`);
            }
        }
    };

    const handleGroupToggle = (employeeId: number, groupId: number) => {
        setSelectedGroups(prev => {
            const newSelection = new Set(prev[employeeId] || []);
            if (newSelection.has(groupId)) {
                newSelection.delete(groupId);
            } else {
                newSelection.add(groupId);
            }
            return { ...prev, [employeeId]: newSelection };
        });
    };

    const handleSave = async (employee: Employee) => {
        setSaving(employee.id);
        setError(null);
        setSuccess(null);
        try {
            await onboardingService.assignGroups({
                employee_id: employee.id,
                groups: Array.from(selectedGroups[employee.id] || [])
            });
            setSuccess(`Groups assigned to ${employee.first_name} successfully!`);
            // Remover al empleado de la lista de pendientes
            setPendingEmployees(prev => prev.filter(e => e.id !== employee.id));
        } catch (err) {
            setError(`Failed to assign groups to ${employee.first_name}. Please try again.`);
        } finally {
            setSaving(null);
        }
    };

    const groupedGroups = groupByCategory(allGroups);

  return (
    <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>Pending Employees Onboarding</Typography>
        {loading && <CircularProgress />}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
        
        {!loading && pendingEmployees.length === 0 && !error && (
            <Alert severity="info">No pending employees to onboard.</Alert>
        )}
        
        {!loading && pendingEmployees.map((employee) => (
            <Accordion 
                key={employee.id} 
                sx={{ mb: 1 }} 
                expanded={expandedEmployee === employee.id}
                onChange={handleAccordionChange(employee.id)}
            >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography sx={{ fontWeight: 'bold' }}>{`${employee.first_name} ${employee.last_name}`}</Typography>
                    <Typography sx={{ color: 'text.secondary', ml: 2 }}>{`(${employee.role.replace('_', ' ')})`}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <Typography variant="subtitle2" gutterBottom>Assign Telegram Groups:</Typography>
                    {Object.entries(groupedGroups).map(([categoryName, groupsInCategory]) => (
                        <Box key={categoryName} sx={{ mb: 2 }}>
                            <Typography variant="caption" sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}>
                                {categoryName}
                            </Typography>
                            <FormGroup>
                                {groupsInCategory.map(group => (
                                    <FormControlLabel
                                        key={group.id}
                                        control={
                                            <Checkbox
                                                checked={(selectedGroups[employee.id] || new Set()).has(group.id)}
                                                onChange={() => handleGroupToggle(employee.id, group.id)}
                                            />
                                        }
                                        label={`${group.name} (${group.branch?.name || 'General'})`}
                                    />
                                ))}
                            </FormGroup>
                        </Box>
                    ))}
                    <Box sx={{ mt: 2 }}>
                        <Button 
                            variant="contained" 
                            onClick={() => handleSave(employee)} 
                            disabled={saving === employee.id}
                            size="small"
                        >
                            {saving === employee.id ? <CircularProgress size={24} /> : 'Assign Groups'}
                        </Button>
                    </Box>
                </AccordionDetails>
            </Accordion>
        ))}
    </Paper>
  );
};

export default OnboardingTab;
