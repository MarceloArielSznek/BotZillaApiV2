import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    FormControl,
    FormLabel,
    RadioGroup,
    FormControlLabel,
    Radio,
    Select,
    MenuItem,
    Checkbox,
    ListItemText,
    OutlinedInput,
    Box,
    Typography,
    Alert,
    CircularProgress,
    Divider,
    SelectChangeEvent
} from '@mui/material';
import { Employee } from '@/services/employeeService';
import { TelegramGroup } from '@/services/telegramGroupService';

interface ActivateEmployeeModalProps {
    open: boolean;
    employee: Employee | null;
    allBranches: Array<{ id: number; name: string }>;
    allGroups: TelegramGroup[];
    onClose: () => void;
    onConfirm: (data: {
        final_role: 'crew_member' | 'crew_leader' | 'sales_person';
        branches: number[];
        is_leader?: boolean;
        animal?: string;
        telegram_groups: number[];
    }) => Promise<void>;
}

const ANIMALS = ['Lion', 'Tiger', 'Bear', 'Eagle', 'Shark', 'Wolf', 'Panther', 'Falcon'];

const ActivateEmployeeModal: React.FC<ActivateEmployeeModalProps> = ({
    open,
    employee,
    allBranches,
    allGroups,
    onClose,
    onConfirm
}) => {
    const [finalRole, setFinalRole] = useState<'crew_member' | 'crew_leader' | 'sales_person'>('crew_member');
    const [selectedBranches, setSelectedBranches] = useState<number[]>([]);
    const [animal, setAnimal] = useState<string>('');
    const [selectedGroups, setSelectedGroups] = useState<number[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset form cuando se abre el modal o cambia el employee
    useEffect(() => {
        if (open && employee) {
            // Set default role based on employee.role
            if (employee.role === 'crew_leader') {
                setFinalRole('crew_leader');
            } else if (employee.role === 'salesperson') {
                setFinalRole('sales_person');
            } else {
                setFinalRole('crew_member');
            }

            // Set default branch
            if (employee.branch_id) {
                setSelectedBranches([employee.branch_id]);
            } else {
                setSelectedBranches([]);
            }

            setAnimal('');
            setError(null);

            // Auto-select relevant telegram groups
            autoSelectGroups(employee.role, employee.branch_id || null);
        }
    }, [open, employee]);

    // Auto-update groups when role or branches change
    useEffect(() => {
        if (employee) {
            autoSelectGroups(finalRole, selectedBranches.length > 0 ? selectedBranches[0] : null);
        }
    }, [finalRole, selectedBranches]);

    const autoSelectGroups = (role: string, branchId: number | null) => {
        const roleToCategoryMap: { [key: string]: string } = {
            salesperson: 'Sales',
            sales_person: 'Sales',
            crew_member: 'Crew Members',
            crew_leader: 'Crew Leaders'
        };

        const targetCategoryName = roleToCategoryMap[role];

        const relevantGroups = allGroups.filter(g => {
            if (!g.is_default) return false;
            const branchMatch = g.branch_id === null || g.branch_id === branchId;
            if (!branchMatch) return false;
            const isUniversalGroup = !g.category_id;
            const isRoleMatch = g.category && targetCategoryName && 
                g.category.name.toLowerCase() === targetCategoryName.toLowerCase();
            return isUniversalGroup || isRoleMatch;
        });

        setSelectedGroups(relevantGroups.map(g => g.id));
    };

    const handleBranchChange = (event: SelectChangeEvent<typeof selectedBranches>) => {
        const value = event.target.value;
        setSelectedBranches(typeof value === 'string' ? [] : value);
    };

    const handleGroupChange = (event: SelectChangeEvent<typeof selectedGroups>) => {
        const value = event.target.value;
        setSelectedGroups(typeof value === 'string' ? [] : value);
    };

    const handleConfirm = async () => {
        setError(null);

        // Validations
        if (selectedBranches.length === 0) {
            setError('Please select at least one branch.');
            return;
        }

        if ((finalRole === 'crew_member' || finalRole === 'crew_leader') && !animal) {
            setError('Please select an animal for crew members.');
            return;
        }

        setLoading(true);
        try {
            await onConfirm({
                final_role: finalRole,
                branches: selectedBranches,
                is_leader: finalRole === 'crew_leader',
                animal: (finalRole === 'crew_member' || finalRole === 'crew_leader') ? animal : undefined,
                telegram_groups: selectedGroups
            });
            handleClose();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to activate employee. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading) {
            setFinalRole('crew_member');
            setSelectedBranches([]);
            setAnimal('');
            setSelectedGroups([]);
            setError(null);
            onClose();
        }
    };

    if (!employee) return null;

    const isCrew = finalRole === 'crew_member' || finalRole === 'crew_leader';

    // Filter groups relevant to selected branches
    const relevantGroups = allGroups.filter(g => 
        g.branch_id === null || selectedBranches.includes(g.branch_id)
    );

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                Activate Employee: {employee.first_name} {employee.last_name}
            </DialogTitle>
            <DialogContent dividers>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {/* Employee Info */}
                    <Box>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Employee Information
                        </Typography>
                        <Typography variant="body2">
                            <strong>Name:</strong> {employee.first_name} {employee.last_name}
                        </Typography>
                        <Typography variant="body2">
                            <strong>Email:</strong> {employee.email}
                        </Typography>
                        <Typography variant="body2">
                            <strong>Current Role:</strong> {employee.role.replace('_', ' ')}
                        </Typography>
                    </Box>

                    <Divider />

                    {/* Role Selection */}
                    <FormControl component="fieldset">
                        <FormLabel component="legend">Final Role</FormLabel>
                        <RadioGroup
                            value={finalRole}
                            onChange={(e) => setFinalRole(e.target.value as any)}
                        >
                            <FormControlLabel 
                                value="crew_member" 
                                control={<Radio />} 
                                label="Crew Member" 
                            />
                            <FormControlLabel 
                                value="crew_leader" 
                                control={<Radio />} 
                                label="Crew Leader" 
                            />
                            <FormControlLabel 
                                value="sales_person" 
                                control={<Radio />} 
                                label="Sales Person" 
                            />
                        </RadioGroup>
                    </FormControl>

                    {/* Branch Selection */}
                    <FormControl fullWidth>
                        <FormLabel>Branches *</FormLabel>
                        <Select<number[]>
                            multiple
                            value={selectedBranches}
                            onChange={handleBranchChange}
                            renderValue={(selected) => 
                                allBranches
                                    .filter(b => selected.includes(b.id))
                                    .map(b => b.name)
                                    .join(', ')
                            }
                        >
                            {allBranches.map((branch) => (
                                <MenuItem key={branch.id} value={branch.id}>
                                    <Checkbox checked={selectedBranches.includes(branch.id)} />
                                    <ListItemText primary={branch.name} />
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* Animal Selection (only for crew) */}
                    {isCrew && (
                        <FormControl fullWidth>
                            <FormLabel>Animal *</FormLabel>
                            <Select
                                value={animal}
                                onChange={(e) => setAnimal(e.target.value)}
                                displayEmpty
                            >
                                <MenuItem value="" disabled>
                                    <em>Select an animal</em>
                                </MenuItem>
                                {ANIMALS.map((a) => (
                                    <MenuItem key={a} value={a}>
                                        {a}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}

                    <Divider />

                    {/* Telegram Groups */}
                    <FormControl fullWidth>
                        <FormLabel>Telegram Groups (auto-selected)</FormLabel>
                        <Select<number[]>
                            multiple
                            value={selectedGroups}
                            onChange={handleGroupChange}
                            renderValue={(selected) => {
                                const count = selected.length;
                                return `${count} group${count !== 1 ? 's' : ''} selected`;
                            }}
                        >
                            {relevantGroups.map((group) => (
                                <MenuItem key={group.id} value={group.id}>
                                    <Checkbox checked={selectedGroups.includes(group.id)} />
                                    <ListItemText 
                                        primary={group.name}
                                        secondary={`${group.branch?.name || 'General'} - ${group.category?.name || 'No Category'}`}
                                    />
                                </MenuItem>
                            ))}
                        </Select>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                            Groups are automatically selected based on role and branches.
                        </Typography>
                    </FormControl>

                    {/* Error Alert */}
                    {error && (
                        <Alert severity="error" onClose={() => setError(null)}>
                            {error}
                        </Alert>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} disabled={loading}>
                    Cancel
                </Button>
                <Button 
                    onClick={handleConfirm} 
                    variant="contained" 
                    disabled={loading}
                    startIcon={loading && <CircularProgress size={20} />}
                >
                    {loading ? 'Activating...' : 'Activate & Create'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ActivateEmployeeModal;

