import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Business as BusinessIcon,
  People as PeopleIcon,
  AttachMoney as MoneyIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import branchService, { 
  type Branch, 
  type BranchListParams, 
  type CreateBranchData, 
  type UpdateBranchData 
} from '../services/branchService';

const Branches = () => {
  // Estados principales
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Estados de paginación
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // Estados de filtros
  const [search, setSearch] = useState('');
  const [includeStats, setIncludeStats] = useState(true);

  // Estados de modales
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

  // Estados de formularios
  const [formData, setFormData] = useState<CreateBranchData>({
    name: '',
    address: ''
  });
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [submitLoading, setSubmitLoading] = useState(false);

  // Cargar branches
  useEffect(() => {
    loadBranches();
  }, [page, rowsPerPage, search, includeStats]);

  const loadBranches = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params: BranchListParams = {
        page: page + 1,
        limit: rowsPerPage,
        search: search || undefined,
        includeStats
      };

      const response = await branchService.getBranches(params);
      setBranches(response.branches);
      setTotalCount(response.pagination.totalCount);
    } catch (error: any) {
              setError('Error loading branches: ' + (error.response?.data?.message || error.message));
      setBranches([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(0); // Reset a primera página
  };

  const handleRefresh = () => {
    loadBranches();
  };

  // Funciones de modal
  const openCreateModal = () => {
    setFormData({ name: '', address: '' });
    setFormErrors({});
    setCreateModalOpen(true);
  };

  const openEditModal = (branch: Branch) => {
    setFormData({
      name: branch.name,
      address: branch.address
    });
    setFormErrors({});
    setSelectedBranch(branch);
    setEditModalOpen(true);
  };

  const openViewModal = async (branch: Branch) => {
    try {
      setLoading(true);
      const fullBranch = await branchService.getBranchById(branch.id);
      setSelectedBranch(fullBranch);
      setViewModalOpen(true);
    } catch (error: any) {
      setError('Error loading branch details: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const closeModals = () => {
    setCreateModalOpen(false);
    setEditModalOpen(false);
    setViewModalOpen(false);
    setSelectedBranch(null);
    setFormData({ name: '', address: '' });
    setFormErrors({});
  };

  // Form validation
  const validateForm = (): boolean => {
    const errors: {[key: string]: string} = {};

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Create branch
  const handleCreate = async () => {
    if (!validateForm()) return;

    try {
      setSubmitLoading(true);
      await branchService.createBranch(formData);
      setSuccess('Branch created successfully');
      closeModals();
      loadBranches();
    } catch (error: any) {
      setError('Error creating branch: ' + (error.response?.data?.message || error.message));
    } finally {
      setSubmitLoading(false);
    }
  };

  // Update branch
  const handleUpdate = async () => {
    if (!validateForm() || !selectedBranch) return;

    try {
      setSubmitLoading(true);
      await branchService.updateBranch(selectedBranch.id, formData);
      setSuccess('Branch updated successfully');
      closeModals();
      loadBranches();
    } catch (error: any) {
      setError('Error updating branch: ' + (error.response?.data?.message || error.message));
    } finally {
      setSubmitLoading(false);
    }
  };

  // Delete branch
  const handleDelete = async (branch: Branch) => {
    if (!window.confirm(`Are you sure you want to delete the branch "${branch.name}"?`)) {
      return;
    }

    try {
      setLoading(true);
      await branchService.deleteBranch(branch.id);
      setSuccess('Branch deleted successfully');
      loadBranches();
    } catch (error: any) {
      setError('Error deleting branch: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Formatear número
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-ES').format(num);
  };

  // Formatear dinero
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <BusinessIcon sx={{ mr: 1, fontSize: 32 }} />
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
            Branches
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Tooltip title="Refresh data">
            <IconButton onClick={handleRefresh} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreateModal}
            disabled={loading}
          >
            New Branch
          </Button>
        </Box>
      </Box>

      {/* Alertas */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              label="Search branches..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              sx={{ minWidth: 250 }}
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Statistics</InputLabel>
              <Select
                value={includeStats ? 'true' : 'false'}
                onChange={(e) => setIncludeStats(e.target.value === 'true')}
                label="Statistics"
              >
                <MenuItem value="true">Include</MenuItem>
                <MenuItem value="false">Don't include</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell><strong>ID</strong></TableCell>
                      <TableCell><strong>Name</strong></TableCell>
                      <TableCell><strong>Address</strong></TableCell>
                      {includeStats && (
                        <>
                          <TableCell><strong>Salespersons</strong></TableCell>
                          <TableCell><strong>Estimates</strong></TableCell>
                          <TableCell><strong>Revenue</strong></TableCell>
                        </>
                      )}
                      <TableCell align="center"><strong>Actions</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {branches.map((branch) => (
                      <TableRow key={branch.id} hover>
                        <TableCell>{branch.id}</TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                            {branch.name}
                          </Typography>
                        </TableCell>
                        <TableCell>{branch.address || 'N/A'}</TableCell>
                        {includeStats && (
                          <>
                            <TableCell>
                              <Chip
                                icon={<PeopleIcon />}
                                label={formatNumber(branch.stats?.salesPersonsCount || 0)}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={formatNumber(branch.stats?.estimatesCount || 0)}
                                size="small"
                                color="info"
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>
                              <Chip
                                icon={<MoneyIcon />}
                                label={formatMoney(branch.stats?.totalRevenue || 0)}
                                size="small"
                                color="success"
                                variant="outlined"
                              />
                            </TableCell>
                          </>
                        )}
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                            <Tooltip title="View details">
                              <IconButton
                                size="small"
                                onClick={() => openViewModal(branch)}
                                color="info"
                              >
                                <ViewIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Edit">
                              <IconButton
                                size="small"
                                onClick={() => openEditModal(branch)}
                                color="primary"
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton
                                size="small"
                                onClick={() => handleDelete(branch)}
                                color="error"
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                    {branches.length === 0 && !loading && (
                      <TableRow>
                        <TableCell colSpan={includeStats ? 7 : 4} align="center" sx={{ py: 4 }}>
                          <Typography variant="body1" color="text.secondary">
                            No branches found
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              
              <TablePagination
                component="div"
                count={totalCount}
                page={page}
                onPageChange={(e, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
                }}
                rowsPerPageOptions={[5, 10, 25, 50]}
                labelRowsPerPage="Rows per page:"
                labelDisplayedRows={({ from, to, count }) => 
                  `${from}-${to} of ${count !== -1 ? count : `more than ${to}`}`
                }
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Modal */}
      <Dialog open={createModalOpen} onClose={closeModals} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Branch</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              fullWidth
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              error={!!formErrors.name}
              helperText={formErrors.name}
              required
            />
            <TextField
              fullWidth
              label="Address"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              error={!!formErrors.address}
              helperText={formErrors.address}
              multiline
              rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeModals} disabled={submitLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={submitLoading}
            startIcon={submitLoading ? <CircularProgress size={20} /> : <AddIcon />}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={editModalOpen} onClose={closeModals} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Branch</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              fullWidth
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              error={!!formErrors.name}
              helperText={formErrors.name}
              required
            />
            <TextField
              fullWidth
              label="Address"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              error={!!formErrors.address}
              helperText={formErrors.address}
              multiline
              rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeModals} disabled={submitLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleUpdate}
            disabled={submitLoading}
            startIcon={submitLoading ? <CircularProgress size={20} /> : <EditIcon />}
          >
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* Details Modal */}
      <Dialog open={viewModalOpen} onClose={closeModals} maxWidth="md" fullWidth>
        <DialogTitle>Branch Details</DialogTitle>
        <DialogContent>
          {selectedBranch && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
              <Box>
                <Typography variant="h6" gutterBottom>General Information</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <TextField
                    label="ID"
                    value={selectedBranch.id}
                    InputProps={{ readOnly: true }}
                    variant="outlined"
                  />
                  <TextField
                    label="Name"
                    value={selectedBranch.name}
                    InputProps={{ readOnly: true }}
                    variant="outlined"
                  />
                  <TextField
                    label="Address"
                    value={selectedBranch.address || 'N/A'}
                    InputProps={{ readOnly: true }}
                    variant="outlined"
                    sx={{ gridColumn: '1 / -1' }}
                  />
                </Box>
              </Box>
              
              {selectedBranch.stats && (
                <Box>
                  <Typography variant="h6" gutterBottom>Statistics</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
                    <Card variant="outlined">
                      <CardContent sx={{ textAlign: 'center' }}>
                        <PeopleIcon color="primary" sx={{ fontSize: 32, mb: 1 }} />
                        <Typography variant="h4" color="primary">
                          {formatNumber(selectedBranch.stats.salesPersonsCount)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Salespersons
                        </Typography>
                      </CardContent>
                    </Card>
                    <Card variant="outlined">
                      <CardContent sx={{ textAlign: 'center' }}>
                        <BusinessIcon color="info" sx={{ fontSize: 32, mb: 1 }} />
                        <Typography variant="h4" color="info.main">
                          {formatNumber(selectedBranch.stats.estimatesCount)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Estimates
                        </Typography>
                      </CardContent>
                    </Card>
                    <Card variant="outlined">
                      <CardContent sx={{ textAlign: 'center' }}>
                        <MoneyIcon color="success" sx={{ fontSize: 32, mb: 1 }} />
                        <Typography variant="h4" color="success.main">
                          {formatMoney(selectedBranch.stats.totalRevenue)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Total Revenue
                        </Typography>
                      </CardContent>
                    </Card>
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeModals}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Branches; 