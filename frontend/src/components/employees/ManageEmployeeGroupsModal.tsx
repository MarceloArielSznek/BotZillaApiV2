import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button,
    Typography, FormGroup, FormControlLabel, Checkbox, Box, CircularProgress, Alert
} from '@mui/material';
import { Employee } from '@/services/employeeService';
import telegramGroupService, { TelegramGroup } from '@/services/telegramGroupService';
import employeeService from '@/services/employeeService'; // Importar el servicio correcto
import onboardingService from '@/services/onboardingService';
import { groupByCategory } from '@/utils/grouping'; // Suponiendo que movemos la función a un helper

interface ManageEmployeeGroupsModalProps {
    open: boolean;
    onClose: () => void;
    employee: Employee | null;
}

const ManageEmployeeGroupsModal: React.FC<ManageEmployeeGroupsModalProps> = ({ open, onClose, employee }) => {
    const [allGroups, setAllGroups] = useState<TelegramGroup[]>([]);
    const [selectedGroups, setSelectedGroups] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadData = async () => {
            if (open && employee) {
                setLoading(true);
                setError(null);
                try {
                    const [groupsRes, assignedGroupsRes] = await Promise.all([
                        telegramGroupService.getAll(1, 1000),
                        employeeService.getAssignedGroups(employee.id) // Usar la función correcta
                    ]);
                    if (groupsRes && groupsRes.data) setAllGroups(groupsRes.data);
                    if (assignedGroupsRes) setSelectedGroups(new Set(assignedGroupsRes.map(g => g.id)));
                } catch (err) {
                    setError('Failed to load group data.');
                } finally {
                    setLoading(false);
                }
            }
        };
        loadData();
    }, [open, employee]);

    const handleGroupToggle = (groupId: number) => {
        setSelectedGroups(prev => {
            const newSelection = new Set(prev);
            if (newSelection.has(groupId)) {
                newSelection.delete(groupId);
            } else {
                newSelection.add(groupId);
            }
            return newSelection;
        });
    };

    const handleSave = async () => {
        if (!employee) return;
        setSaving(true);
        setError(null);
        try {
            await onboardingService.assignGroups({
                employee_id: employee.id,
                groups: Array.from(selectedGroups)
            });
            onClose(); // Cerrar el modal al guardar con éxito
        } catch (err) {
            setError('Failed to save changes.');
        } finally {
            setSaving(false);
        }
    };

    const groupedGroups = groupByCategory(allGroups);

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle>
                Manage Groups for {employee ? `${employee.first_name} ${employee.last_name}` : ''}
            </DialogTitle>
            <DialogContent>
                {loading && <CircularProgress />}
                {error && <Alert severity="error">{error}</Alert>}
                {!loading && !error && Object.entries(groupedGroups).map(([categoryName, groupsInCategory]) => (
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
                                            checked={selectedGroups.has(group.id)}
                                            onChange={() => handleGroupToggle(group.id)}
                                        />
                                    }
                                    label={`${group.name} (${group.branch?.name || 'General'})`}
                                />
                            ))}
                        </FormGroup>
                    </Box>
                ))}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave} variant="contained" disabled={saving}>
                    {saving ? <CircularProgress size={24} /> : 'Save Changes'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ManageEmployeeGroupsModal;
