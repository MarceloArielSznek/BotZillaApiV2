import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, TablePagination, TextField, InputAdornment,
  CircularProgress, Alert, Chip, IconButton, Tooltip, Avatar,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TableSortLabel, FormControl, InputLabel, Select, MenuItem, type SelectChangeEvent, Switch, FormControlLabel
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  Search as SearchIcon, Refresh as RefreshIcon, Visibility as ViewIcon,
  Send as SendIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { debounce } from 'lodash';
import salespersonService from '../../services/salespersonService';
import branchService from '../../services/branchService';
import type { SalesPerson, Branch, Estimate, UpdateSalesPersonData, CreateSalesPersonData } from '../../interfaces';

type Order = 'asc' | 'desc';
type OrderBy = 'name' | 'activeLeadsCount' | 'warning_count';

const initialCreateFormData: CreateSalesPersonData = {
    name: '',
    phone: '',
    telegram_id: '',
    branchIds: [],
};

const SalespersonsTab: React.FC = () => {
    const [salespersons, setSalespersons] = useState<SalesPerson[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [total, setTotal] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [branchFilter, setBranchFilter] = useState('');
    const [showInactive, setShowInactive] = useState(false);
    
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [createModalOpen, setCreateModalOpen] = useState(false);
    
    const [selectedSalesperson, setSelectedSalesperson] = useState<SalesPerson | null>(null);
    const [activeEstimates, setActiveEstimates] = useState<Estimate[]>([]);
    const [estimatesLoading, setEstimatesLoading] = useState(false);
    const [reportSending, setReportSending] = useState(false);
    
    const [createFormData, setCreateFormData] = useState<CreateSalesPersonData>(initialCreateFormData);
    const [editFormData, setEditFormData] = useState<UpdateSalesPersonData>({ name: '', phone: '', telegram_id: '' });
    const [submitLoading, setSubmitLoading] = useState(false);

    const [branchToAdd, setBranchToAdd] = useState<number | ''>('');

    const [order, setOrder] = useState<Order>('asc');
    const [orderBy, setOrderBy] = useState<OrderBy>('name');

    const { enqueueSnackbar } = useSnackbar();

    const fetchSalespersons = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                page: page + 1,
                limit: rowsPerPage,
                search: searchTerm,
                branchId: branchFilter ? Number(branchFilter) : null,
                include_inactive: showInactive,
            };
            const data = await salespersonService.getSalesPersons(params);
            setSalespersons(data.salespersons);
            setTotal(data.pagination.totalCount);
        } catch (err: any) {
            setError(err.message);
            enqueueSnackbar('Error fetching salespersons: ' + err.message, { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, searchTerm, branchFilter, showInactive, enqueueSnackbar]);

    const fetchBranches = useCallback(async () => {
        try {
            const response = await branchService.getBranches({ limit: 1000 });
            // Corrección: Añadir una comprobación para asegurar que la respuesta y los datos existen
            if (response && response.branches) {
                setBranches(response.branches);
            } else {
                setBranches([]); // Asegurarse de que sea un array vacío si no hay datos
            }
        } catch (error) {
            console.error('Failed to fetch branches:', error);
            setBranches([]); // En caso de error, establecer un array vacío
        }
    }, [enqueueSnackbar]);

    useEffect(() => {
        fetchSalespersons();
    }, [fetchSalespersons]);

    useEffect(() => {
        fetchBranches();
    }, [fetchBranches]);


    const debouncedSearch = useCallback(debounce(() => {
        fetchSalespersons();
    }, 500), [fetchSalespersons]);

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value);
        debouncedSearch();
    };

    const handleBranchFilterChange = (event: SelectChangeEvent) => {
        setPage(0);
        setBranchFilter(event.target.value as string);
    };

    const handleRequestSort = (property: OrderBy) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
        const sorted = [...salespersons].sort((a, b) => {
            if (a[property] < b[property]) return order === 'asc' ? 1 : -1;
            if (a[property] > b[property]) return order === 'asc' ? -1 : 1;
            return 0;
        });
        setSalespersons(sorted);
    };

    const openCreateModal = () => {
        setCreateFormData(initialCreateFormData);
        setCreateModalOpen(true);
    };

    const openEditModal = (salesperson: SalesPerson) => {
        setSelectedSalesperson(salesperson);
        setEditFormData({
            name: salesperson.name,
            phone: salesperson.phone || '',
            telegram_id: salesperson.telegram_id || '',
        });
        setBranchToAdd('');
        setEditModalOpen(true);
    };

    const handleCreate = async () => {
        if (!createFormData.name.trim()) {
            enqueueSnackbar('Salesperson name is required.', { variant: 'warning' });
            return;
        }
        if (createFormData.branchIds.length === 0) {
            enqueueSnackbar('At least one branch must be selected.', { variant: 'warning' });
            return;
        }

        setSubmitLoading(true);
        try {
            await salespersonService.createSalesPerson(createFormData);
            enqueueSnackbar('Salesperson created successfully!', { variant: 'success' });
            setCreateModalOpen(false);
            fetchSalespersons();
        } catch (err: any) {
            enqueueSnackbar(`Error: ${err.response?.data?.message || err.message}`, { variant: 'error' });
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleUpdate = async () => {
        if (!selectedSalesperson) return;
        if (!editFormData.name.trim()) {
            enqueueSnackbar('Salesperson name cannot be empty.', { variant: 'warning' });
            return;
        }
        setSubmitLoading(true);
        try {
            await salespersonService.updateSalesPerson(selectedSalesperson.id, editFormData);
            enqueueSnackbar('Salesperson updated successfully', { variant: 'success' });
            setEditModalOpen(false);
            fetchSalespersons();
        } catch (err: any) {
             enqueueSnackbar(`Error: ${err.response?.data?.message || err.message}`, { variant: 'error' });
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleDelete = async (salesperson: SalesPerson) => {
        if (window.confirm(`Are you sure you want to delete ${salesperson.name}?`)) {
            try {
                await salespersonService.deleteSalesPerson(salesperson.id);
                enqueueSnackbar('Salesperson deleted successfully', { variant: 'success' });
                fetchSalespersons();
            } catch (err: any) {
                enqueueSnackbar('Error deleting salesperson: ' + err.message, { variant: 'error' });
            }
        }
    };

    const handleAddBranch = async () => {
        if (!selectedSalesperson || !branchToAdd) return;
        setSubmitLoading(true);
        try {
            await salespersonService.addBranchToSalesperson(selectedSalesperson.id, Number(branchToAdd));
            enqueueSnackbar('Branch added successfully', { variant: 'success' });
            
            const updatedSalesperson = await salespersonService.getSalesPersonById(selectedSalesperson.id);
            setSelectedSalesperson(updatedSalesperson);

            setBranchToAdd('');
            fetchSalespersons(); // Refresh the main list
        } catch (err: any) {
            enqueueSnackbar(`Error adding branch: ${err.response?.data?.message || err.message}`, { variant: 'error' });
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleRemoveBranch = async (branchId: number) => {
        if (!selectedSalesperson) return;
        setSubmitLoading(true);
        try {
            await salespersonService.removeBranchFromSalesperson(selectedSalesperson.id, branchId);
            enqueueSnackbar('Branch removed successfully', { variant: 'success' });

            const updatedSalesperson = await salespersonService.getSalesPersonById(selectedSalesperson.id);
            setSelectedSalesperson(updatedSalesperson);
            
            fetchSalespersons(); // Refresh the main list
        } catch (err: any) {
            enqueueSnackbar(`Error removing branch: ${err.response?.data?.message || err.message}`, { variant: 'error' });
        } finally {
            setSubmitLoading(false);
        }
    };


    const handleViewDetails = async (salesperson: SalesPerson) => {
        setSelectedSalesperson(salesperson);
        setViewModalOpen(true);
        setEstimatesLoading(true);
        try {
            const estimates = await salespersonService.getActiveEstimates(salesperson.id);
            setActiveEstimates(estimates);
        } catch (err: any) {
            enqueueSnackbar('Error fetching active estimates: ' + err.message, { variant: 'error' });
        } finally {
            setEstimatesLoading(false);
        }
    };

    const handleSendReport = async () => {
        if (!selectedSalesperson) return;
        setReportSending(true);
        try {
            const response = await salespersonService.sendReport(selectedSalesperson.id);
            enqueueSnackbar(response.message, { variant: 'success' });
        } catch (err: any) {
            enqueueSnackbar('Error sending report: ' + err.message, { variant: 'error' });
        } finally {
            setReportSending(false);
        }
    };

    const handleToggleActive = async (id: number, isActive: boolean) => {
        try {
            await salespersonService.toggleSalesPersonStatus(id, isActive);
            enqueueSnackbar(`Salesperson ${isActive ? 'activated' : 'deactivated'} successfully!`, { variant: 'success' });
            fetchSalespersons();
        } catch (err: any) {
            enqueueSnackbar(`Error: ${err.response?.data?.message || err.message}`, { variant: 'error' });
        }
    };

    
    const availableBranches = branches.filter(b => 
        !selectedSalesperson?.branches.some(assigned => assigned.id === b.id)
    );

    return (
        <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box display="flex" gap={2} alignItems="center">
                    <TextField
                        variant="outlined"
                        placeholder="Search by name..."
                        value={searchTerm}
                        onChange={handleSearchChange}
                        InputProps={{
                            startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
                        }}
                    />
                    <FormControl variant="outlined" sx={{ minWidth: 200 }}>
                        <InputLabel>Branch</InputLabel>
                        <Select
                            value={branchFilter}
                            onChange={handleBranchFilterChange}
                            label="Branch"
                        >
                            <MenuItem value=""><em>All Branches</em></MenuItem>
                            {branches && branches.map(branch => (
                                <MenuItem key={branch.id} value={branch.id}>{branch.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={showInactive}
                                onChange={(e) => setShowInactive(e.target.checked)}
                            />
                        }
                        label="Show Inactive"
                    />
                </Box>
                <Box display="flex" gap={2}>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateModal}>New Salesperson</Button>
                </Box>
            </Box>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell sortDirection={orderBy === 'name' ? order : false}>
                                <TableSortLabel active={orderBy === 'name'} direction={order} onClick={() => handleRequestSort('name')}>
                                    Salesperson
                                </TableSortLabel>
                            </TableCell>
                            <TableCell>Branches</TableCell>
                            <TableCell>Telegram ID</TableCell>
                            <TableCell sortDirection={orderBy === 'activeLeadsCount' ? order : false}>
                                <TableSortLabel active={orderBy === 'activeLeadsCount'} direction={order} onClick={() => handleRequestSort('activeLeadsCount')}>
                                    Active Leads
                                </TableSortLabel>
                            </TableCell>
                            <TableCell sortDirection={orderBy === 'warning_count' ? order : false}>
                                <TableSortLabel active={orderBy === 'warning_count'} direction={order} onClick={() => handleRequestSort('warning_count')}>
                                    Warnings
                                </TableSortLabel>
                            </TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={7} align="center"><CircularProgress /></TableCell></TableRow>
                        ) : salespersons.map((sp) => (
                            <TableRow 
                                key={sp.id} 
                                sx={{ 
                                    backgroundColor: !sp.is_active ? 'rgba(0, 0, 0, 0.02)' : 'inherit',
                                    opacity: !sp.is_active ? 0.85 : 1,
                                    '&:hover': {
                                        backgroundColor: !sp.is_active ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.08)'
                                    }
                                }}
                            >
                                <TableCell>
                                    <Box display="flex" alignItems="center" gap={1}>
                                        <Typography 
                                            variant="body2" 
                                            sx={{ 
                                                color: !sp.is_active ? 'rgba(255, 255, 255, 0.7)' : 'inherit',
                                                fontStyle: !sp.is_active ? 'italic' : 'normal'
                                            }}
                                        >
                                            {sp.name}
                                        </Typography>
                                        {!sp.is_active && (
                                            <Chip 
                                                label="Inactive" 
                                                size="small" 
                                                sx={{
                                                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                                    color: 'rgba(255, 255, 255, 0.7)',
                                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                                    fontSize: '0.7rem',
                                                    height: '20px',
                                                    '& .MuiChip-label': {
                                                        padding: '0 6px'
                                                    }
                                                }}
                                            />
                                        )}
                                    </Box>
                                </TableCell>
                                <TableCell>
                                    <Box sx={{ opacity: !sp.is_active ? 0.7 : 1 }}>
                                        {sp.branches?.map((b: Branch) => <Chip key={b.id} label={b.name} size="small" sx={{ mr: 0.5 }} />)}
                                    </Box>
                                </TableCell>
                                <TableCell>
                                    <Box sx={{ opacity: !sp.is_active ? 0.7 : 1 }}>
                                        {sp.telegram_id ? (
                                            <Chip label={sp.telegram_id} size="small" color="success" variant="outlined" />
                                        ) : (
                                            <Chip label="Not Set" size="small" />
                                        )}
                                    </Box>
                                </TableCell>
                                <TableCell>
                                    <Typography sx={{ opacity: !sp.is_active ? 0.7 : 1 }}>
                                        {sp.activeLeadsCount}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography sx={{ opacity: !sp.is_active ? 0.7 : 1 }}>
                                        {sp.warning_count}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Tooltip title={sp.is_active ? 'Deactivate' : 'Activate'}>
                                        <Switch
                                            checked={sp.is_active}
                                            onChange={(e) => handleToggleActive(sp.id, e.target.checked)}
                                            sx={{
                                                '& .MuiSwitch-switchBase.Mui-checked': {
                                                    color: '#4caf50'
                                                },
                                                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                                    backgroundColor: '#4caf50'
                                                },
                                                '& .MuiSwitch-switchBase:not(.Mui-checked)': {
                                                    color: 'rgba(255, 255, 255, 0.3)'
                                                },
                                                '& .MuiSwitch-switchBase:not(.Mui-checked) + .MuiSwitch-track': {
                                                    backgroundColor: 'rgba(255, 255, 255, 0.1)'
                                                }
                                            }}
                                        />
                                    </Tooltip>
                                </TableCell>
                                <TableCell>
                                    <Tooltip title="View Details & Send Report">
                                        <IconButton onClick={() => handleViewDetails(sp)}><ViewIcon /></IconButton>
                                    </Tooltip>
                                    <Tooltip title="Edit Salesperson">
                                        <IconButton onClick={() => openEditModal(sp)}><EditIcon /></IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete Salesperson">
                                        <IconButton onClick={() => handleDelete(sp)} color="error"><DeleteIcon /></IconButton>
                                    </Tooltip>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <TablePagination
                    rowsPerPageOptions={[5, 10, 25]}
                    component="div"
                    count={total}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={(e, newPage) => setPage(newPage)}
                    onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                />
            </TableContainer>

            {/* Create Modal */}
            <Dialog open={createModalOpen} onClose={() => setCreateModalOpen(false)} fullWidth>
                <DialogTitle>Create New Salesperson</DialogTitle>
                <DialogContent>
                    <TextField autoFocus margin="dense" label="Name" type="text" fullWidth variant="outlined" value={createFormData.name} onChange={(e) => setCreateFormData({...createFormData, name: e.target.value})} />
                    <TextField margin="dense" label="Phone" type="text" fullWidth variant="outlined" value={createFormData.phone || ''} onChange={(e) => setCreateFormData({...createFormData, phone: e.target.value})} />
                    <TextField margin="dense" label="Telegram ID" type="text" fullWidth variant="outlined" value={createFormData.telegram_id || ''} onChange={(e) => setCreateFormData({...createFormData, telegram_id: e.target.value})} />
                    <FormControl fullWidth margin="dense">
                        <InputLabel>Branches</InputLabel>
                        <Select
                            multiple
                            value={createFormData.branchIds}
                            onChange={(e: SelectChangeEvent<number[]>) => {
                                const value = e.target.value;
                                setCreateFormData({
                                    ...createFormData,
                                    branchIds: typeof value === 'string' ? value.split(',').map(id => parseInt(id, 10)) : value,
                                });
                            }}
                            renderValue={(selected: number[]) => (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {selected.map((id) => (
                                        <Chip key={id} label={branches.find(b => b.id === id)?.name || `ID: ${id}`} />
                                    ))}
                                </Box>
                            )}
                        >
                            {branches && branches.map((branch) => (
                                <MenuItem key={branch.id} value={branch.id}>
                                    {branch.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateModalOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreate} variant="contained" disabled={submitLoading}>
                        {submitLoading ? <CircularProgress size={24} /> : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Edit Modal */}
            <Dialog open={editModalOpen} onClose={() => setEditModalOpen(false)} fullWidth>
                <DialogTitle>Edit {selectedSalesperson?.name}</DialogTitle>
                <DialogContent>
                    {/* Basic Info */}
                    <TextField autoFocus margin="dense" label="Name" type="text" fullWidth variant="outlined" value={editFormData.name} onChange={(e) => setEditFormData({...editFormData, name: e.target.value})} />
                    <TextField margin="dense" label="Phone" type="text" fullWidth variant="outlined" value={editFormData.phone} onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})} />
                    <TextField margin="dense" label="Telegram ID" type="text" fullWidth variant="outlined" value={editFormData.telegram_id} onChange={(e) => setEditFormData({...editFormData, telegram_id: e.target.value})} />
                    
                    {/* Assigned Branches */}
                    <Box mt={2} mb={1}>
                        <Typography variant="subtitle1">Assigned Branches</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, p: 1, border: '1px solid #ccc', borderRadius: 1, minHeight: '40px' }}>
                            {selectedSalesperson?.branches && selectedSalesperson.branches.length > 0 ? (
                                selectedSalesperson.branches.map((branch) => (
                                    <Chip 
                                        key={branch.id} 
                                        label={branch.name} 
                                        onDelete={() => handleRemoveBranch(branch.id)}
                                        disabled={submitLoading}
                                    />
                                ))
                            ) : (
                                <Typography sx={{p:1}} color="textSecondary">No branches assigned.</Typography>
                            )}
                        </Box>
                    </Box>

                    {/* Add Branch */}
                    <Box display="flex" alignItems="center" gap={1} mt={2}>
                        <FormControl fullWidth margin="dense">
                            <InputLabel>Add Branch</InputLabel>
                            <Select
                                value={branchToAdd}
                                onChange={(e) => setBranchToAdd(e.target.value as number | '')}
                                label="Add Branch"
                            >
                                <MenuItem value=""><em>Select a branch</em></MenuItem>
                                {availableBranches.map((branch) => (
                                    <MenuItem key={branch.id} value={branch.id}>
                                        {branch.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Button 
                            onClick={handleAddBranch} 
                            variant="outlined" 
                            disabled={!branchToAdd || submitLoading}
                        >
                            {submitLoading ? <CircularProgress size={24} /> : 'Add'}
                        </Button>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditModalOpen(false)}>Cancel</Button>
                    <Button onClick={handleUpdate} variant="contained" disabled={submitLoading}>
                        {submitLoading ? <CircularProgress size={24} /> : 'Save Changes'}
                    </Button>
                </DialogActions>
            </Dialog>


            {/* View Details Modal */}
            <Dialog open={viewModalOpen} onClose={() => setViewModalOpen(false)} fullWidth maxWidth="md">
                <DialogTitle>Details for {selectedSalesperson?.name}</DialogTitle>
                <DialogContent>
                    <Typography><b>Phone:</b> {selectedSalesperson?.phone || 'N/A'}</Typography>
                    <Typography><b>Telegram ID:</b> {selectedSalesperson?.telegram_id || 'N/A'}</Typography>
                    <Box mt={2}>
                        <Typography variant="h6">Active Estimates</Typography>
                        {estimatesLoading ? <CircularProgress /> : (
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Name</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Last Updated</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {activeEstimates.map((est: Estimate) => (
                                        <TableRow key={est.id}>
                                            <TableCell>{est.name}</TableCell>
                                            <TableCell>{est.status.name}</TableCell>
                                            <TableCell>{new Date(est.at_updated_date).toLocaleDateString()}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setViewModalOpen(false)}>Close</Button>
                    <Button
                        variant="contained"
                        startIcon={reportSending ? <CircularProgress size={20} /> : <SendIcon />}
                        onClick={handleSendReport}
                        disabled={reportSending || estimatesLoading}
                    >
                        Send Report via Telegram
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default SalespersonsTab;
