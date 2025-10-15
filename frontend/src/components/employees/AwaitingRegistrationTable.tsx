import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Button, Chip, CircularProgress, Alert, IconButton, Tooltip,
    TextField, InputAdornment, FormControl, InputLabel, Select, MenuItem, Grid
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import employeeService, { Employee } from '@/services/employeeService';

interface AwaitingRegistrationTableProps {
    active: boolean;
}

const AwaitingRegistrationTable: React.FC<AwaitingRegistrationTableProps> = ({ active }) => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [sendingReminder, setSendingReminder] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    
    // Estados para filtros y búsqueda
    const [searchTerm, setSearchTerm] = useState('');
    const [branchFilter, setBranchFilter] = useState<string>('all');
    const [roleFilter, setRoleFilter] = useState<string>('all');

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await employeeService.getAwaitingRegistration();
            setEmployees(Array.isArray(data) ? data : []);
        } catch (err: any) {
            console.error('Failed to load awaiting registration employees:', err);
            setError('Failed to load employees.');
            setEmployees([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (active) {
            loadData();
        }
    }, [active, loadData]);

    const handleSendReminder = async (employee: Employee) => {
        setSendingReminder(employee.id);
        setError(null);
        setSuccess(null);

        try {
            const result = await employeeService.sendRegistrationReminder(employee.id);
            setSuccess(`✉️ Registration reminder sent to ${employee.email}`);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to send reminder');
        } finally {
            setSendingReminder(null);
        }
    };

    const formatRole = (role: string): string => {
        return role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    const formatDate = (dateString: string): string => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // Obtener listas únicas de branches y roles
    const uniqueBranches = useMemo(() => {
        const branches = employees
            .map(emp => emp.branch?.name)
            .filter((name): name is string => !!name);
        return Array.from(new Set(branches)).sort();
    }, [employees]);

    const uniqueRoles = useMemo(() => {
        const roles = employees
            .map(emp => emp.role)
            .filter((role): role is string => !!role);
        return Array.from(new Set(roles)).sort();
    }, [employees]);

    // Filtrar employees según búsqueda y filtros
    const filteredEmployees = useMemo(() => {
        return employees.filter(employee => {
            // Filtro de búsqueda
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = searchTerm === '' || 
                `${employee.first_name} ${employee.last_name}`.toLowerCase().includes(searchLower) ||
                employee.email.toLowerCase().includes(searchLower);

            // Filtro de branch
            const matchesBranch = branchFilter === 'all' || employee.branch?.name === branchFilter;

            // Filtro de role
            const matchesRole = roleFilter === 'all' || employee.role === roleFilter;

            return matchesSearch && matchesBranch && matchesRole;
        });
    }, [employees, searchTerm, branchFilter, roleFilter]);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                        Awaiting Registration
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Employees from Attic Tech that need to complete their Botzilla registration
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {employees.length > 0 && (
                        <Chip 
                            label={`${filteredEmployees.length} of ${employees.length} awaiting`} 
                            color="warning" 
                            size="small" 
                        />
                    )}
                    <Tooltip title="Refresh">
                        <IconButton onClick={loadData} size="small">
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

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

            {/* Barra de búsqueda y filtros */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={4}>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Search by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon />
                                </InputAdornment>
                            ),
                        }}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                    <FormControl fullWidth size="small">
                        <InputLabel>Branch</InputLabel>
                        <Select
                            value={branchFilter}
                            label="Branch"
                            onChange={(e) => setBranchFilter(e.target.value)}
                        >
                            <MenuItem value="all">All Branches</MenuItem>
                            {uniqueBranches.map(branch => (
                                <MenuItem key={branch} value={branch}>{branch}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                    <FormControl fullWidth size="small">
                        <InputLabel>Role</InputLabel>
                        <Select
                            value={roleFilter}
                            label="Role"
                            onChange={(e) => setRoleFilter(e.target.value)}
                        >
                            <MenuItem value="all">All Roles</MenuItem>
                            {uniqueRoles.map(role => (
                                <MenuItem key={role} value={role}>{formatRole(role)}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>
            </Grid>

            {employees.length === 0 ? (
                <Alert severity="info">
                    No employees awaiting registration.
                </Alert>
            ) : filteredEmployees.length === 0 ? (
                <Alert severity="info">
                    No employees match the current filters.
                </Alert>
            ) : (
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'action.hover' }}>Name</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'action.hover' }}>Email</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'action.hover' }}>Role</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'action.hover' }}>Branch</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'action.hover' }}>Registered</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'action.hover', textAlign: 'center' }}>Action</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredEmployees.map((employee) => (
                                <TableRow 
                                    key={employee.id}
                                    hover
                                    sx={{ '&:last-child td': { border: 0 } }}
                                >
                                    <TableCell>
                                        {employee.first_name} {employee.last_name}
                                    </TableCell>
                                    <TableCell>{employee.email}</TableCell>
                                    <TableCell>
                                        <Chip 
                                            label={formatRole(employee.role)}
                                            size="small"
                                            color="default"
                                        />
                                    </TableCell>
                                    <TableCell>{employee.branch?.name || 'N/A'}</TableCell>
                                    <TableCell>
                                        <Typography variant="body2" color="text.secondary">
                                            {employee.registration_date ? formatDate(employee.registration_date) : 'N/A'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            startIcon={sendingReminder === employee.id ? <CircularProgress size={16} /> : <EmailIcon />}
                                            onClick={() => handleSendReminder(employee)}
                                            disabled={sendingReminder === employee.id}
                                            sx={{ textTransform: 'none' }}
                                        >
                                            {sendingReminder === employee.id ? 'Sending...' : 'Send Reminder'}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Paper>
    );
};

export default AwaitingRegistrationTable;

