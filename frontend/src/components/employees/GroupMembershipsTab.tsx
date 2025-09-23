import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, IconButton, Chip, CircularProgress, Alert
} from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';
import employeeService, { Employee } from '@/services/employeeService';
import { PagedResponse } from '@/interfaces/PagedResponse';
import ManageEmployeeGroupsModal from './ManageEmployeeGroupsModal'; // Importar el nuevo modal

const GroupMembershipsTab = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [pagination, setPagination] = useState<PagedResponse<Employee>['pagination'] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [managingEmployee, setManagingEmployee] = useState<Employee | null>(null);

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async (page = 1) => {
        setLoading(true);
        setError(null);
        try {
            const response = await employeeService.getAll(page);
            if (response && response.data) {
                setEmployees(response.data);
                setPagination(response.pagination);
            }
        } catch (err) {
            setError('Failed to fetch employees.');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (employee: Employee) => {
        setManagingEmployee(employee);
    };

    const handleCloseModal = () => {
        setManagingEmployee(null);
        fetchEmployees(pagination?.currentPage || 1); // Recargar datos al cerrar
    };

    return (
        <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Group Memberships</Typography>
            {loading && <CircularProgress />}
            {error && <Alert severity="error">{error}</Alert>}
            {!loading && (
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Employee</TableCell>
                                <TableCell>Role</TableCell>
                                <TableCell>Assigned Groups</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {employees.map((employee) => (
                                <TableRow key={employee.id}>
                                    <TableCell>{`${employee.first_name} ${employee.last_name}`}</TableCell>
                                    <TableCell>{employee.role}</TableCell>
                                    <TableCell>
                                        <Typography variant="body2">
                                            {`${employee.telegramGroups?.length || 0} groups assigned`}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                        <IconButton size="small" onClick={() => handleOpenModal(employee)}>
                                            <EditIcon />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
            
            <ManageEmployeeGroupsModal
                open={!!managingEmployee}
                onClose={handleCloseModal}
                employee={managingEmployee}
            />
        </Paper>
    );
};

export default GroupMembershipsTab;
