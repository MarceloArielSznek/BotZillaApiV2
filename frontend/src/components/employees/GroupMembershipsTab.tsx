import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, IconButton, CircularProgress, Alert, TablePagination,
    Grid, TextField, InputAdornment, FormControl, InputLabel, Select, MenuItem, TableSortLabel, Snackbar
} from '@mui/material';
import { Edit as EditIcon, Search as SearchIcon, Block as BlockIcon } from '@mui/icons-material';
import employeeService, { Employee, GetEmployeesParams, Branch } from '@/services/employeeService';
import branchService from '@/services/branchService';
import onboardingService from '@/services/onboardingService';
import { PagedResponse } from '@/interfaces/PagedResponse';
import ManageEmployeeGroupsModal from './ManageEmployeeGroupsModal';
import { useDebounce } from '@/hooks/useDebounce';

type Order = 'ASC' | 'DESC';

const GroupMembershipsTab = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [managingEmployee, setManagingEmployee] = useState<Employee | null>(null);
    const [notification, setNotification] = useState('');

    // --- Estados para paginación, filtro y ordenación ---
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalItems, setTotalItems] = useState(0);
    const [nameFilter, setNameFilter] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [branchFilter, setBranchFilter] = useState<number | ''>('');
    const [order, setOrder] = useState<Order>('ASC');
    const [orderBy, setOrderBy] = useState('name');
    const [branches, setBranches] = useState<Branch[]>([]);

    const debouncedNameFilter = useDebounce(nameFilter, 500);

    const fetchEmployees = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params: GetEmployeesParams = {
                page: page + 1,
                limit: rowsPerPage,
                sortBy: orderBy,
                order,
                name: debouncedNameFilter,
                role: roleFilter,
                branchId: branchFilter
            };
            const response = await employeeService.getAll(params);
            if (response && response.data) {
                setEmployees(response.data);
                setTotalItems(response.pagination.totalItems);
            }
        } catch (err) {
            setError('Failed to fetch employees.');
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, orderBy, order, debouncedNameFilter, roleFilter, branchFilter]);
    
    useEffect(() => {
        fetchEmployees();
    }, [fetchEmployees]);
    
    useEffect(() => {
        const fetchBranches = async () => {
            try {
                const res = await branchService.getBranches({ limit: 1000 });
                if (res && res.branches) setBranches(res.branches);
            } catch (error) {
                console.error("Failed to load branches for filter");
            }
        };
        fetchBranches();
    }, []);

    const handleRequestSort = (property: string) => {
        const isAsc = orderBy === property && order === 'ASC';
        setOrder(isAsc ? 'DESC' : 'ASC');
        setOrderBy(property);
    };

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    };
    
    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleOpenModal = (employee: Employee) => {
        setManagingEmployee(employee);
    };

    const handleCloseModal = () => {
        setManagingEmployee(null);
        fetchEmployees(); // Recargar datos cuando se cierra el modal
    };

    const handleKick = async (employee: Employee) => {
        const confirmation = window.confirm(`Are you sure you want to kick ${employee.first_name} ${employee.last_name} from all their Telegram groups? This action cannot be undone.`);
        if (confirmation) {
            try {
                await onboardingService.kickFromAllGroups(employee.id);
                setNotification(`${employee.first_name} has been kicked from all groups.`);
                fetchEmployees(); // Recargar la lista para reflejar los cambios
            } catch (error: any) {
                setError(error.response?.data?.message || 'Failed to kick the employee.');
            }
        }
    };

    return (
        <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Group Memberships</Typography>
            
            <Box sx={{ mb: 2 }}>
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                        <TextField fullWidth placeholder="Search by name..." value={nameFilter} onChange={e => setNameFilter(e.target.value)} InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>)}} />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <FormControl fullWidth sx={{ minWidth: 180 }}>
                            <InputLabel>Role</InputLabel>
                            <Select value={roleFilter} label="Role" onChange={e => setRoleFilter(e.target.value)}>
                                <MenuItem value=""><em>All Roles</em></MenuItem>
                                <MenuItem value="salesperson">Salesperson</MenuItem>
                                <MenuItem value="crew_leader">Crew Leader</MenuItem>
                                <MenuItem value="crew_member">Crew Member</MenuItem>
                                <MenuItem value="corporate">Corporate</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                         <FormControl fullWidth sx={{ minWidth: 180 }}>
                            <InputLabel>Branch</InputLabel>
                            <Select value={branchFilter} label="Branch" onChange={e => setBranchFilter(e.target.value as number | '')}>
                                <MenuItem value=""><em>All Branches</em></MenuItem>
                                {branches.map(b => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Grid>
                </Grid>
            </Box>

            {loading && <CircularProgress />}
            {error && <Alert severity="error">{error}</Alert>}
            {!loading && (
                <>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>
                                        <TableSortLabel active={orderBy === 'name'} direction={orderBy === 'name' ? order.toLowerCase() as 'asc' | 'desc' : 'asc'} onClick={() => handleRequestSort('name')}>
                                            Employee
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell>
                                        <TableSortLabel active={orderBy === 'role'} direction={orderBy === 'role' ? order.toLowerCase() as 'asc' | 'desc' : 'asc'} onClick={() => handleRequestSort('role')}>
                                            Role
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell>Assigned Groups</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {employees.map((employee) => (
                                    <TableRow key={employee.id}>
                                        <TableCell>{`${employee.first_name} ${employee.last_name}`}</TableCell>
                                        <TableCell>{employee.role.replace('_', ' ')}</TableCell>
                                        <TableCell>
                                            <Typography variant="body2">
                                                {`${employee.telegramGroups?.length || 0} groups assigned`}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="right">
                                            <IconButton size="small" onClick={() => handleOpenModal(employee)}>
                                                <EditIcon />
                                            </IconButton>
                                            <IconButton size="small" onClick={() => handleKick(employee)} title="Kick from all groups">
                                                <BlockIcon />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <TablePagination
                        rowsPerPageOptions={[5, 10, 25]}
                        component="div"
                        count={totalItems}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        onPageChange={handleChangePage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                    />
                </>
            )}

            <ManageEmployeeGroupsModal
                open={!!managingEmployee}
                onClose={handleCloseModal}
                employee={managingEmployee}
            />

            <Snackbar
                open={!!notification}
                autoHideDuration={6000}
                onClose={() => setNotification('')}
                message={notification}
            />
        </Paper>
    );
};

export default GroupMembershipsTab;
