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
} from '../../services/branchService';

const BranchesTab = () => {
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
    setPage(0); // Reset to first page
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
    return new Intl.NumberFormat('en-US').format(num);
  };

  // Formatear dinero
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <BusinessIcon sx={{ mr: 1, fontSize: 24 }} />
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
            Branches Management
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
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Search branches..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              sx={{ minWidth: 200, flex: 1 }}
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>View</InputLabel>
              <Select
                value={includeStats ? 'with-stats' : 'simple'}
                onChange={(e) => setIncludeStats(e.target.value === 'with-stats')}
                label="View"
              >
                <MenuItem value="simple">Simple</MenuItem>
                <MenuItem value="with-stats">With Statistics</MenuItem>
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
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: 'text.primary', fontWeight: 'bold' }}>ID</TableCell>
                      <TableCell sx={{ color: 'text.primary', fontWeight: 'bold' }}>Name</TableCell>
                      <TableCell sx={{ color: 'text.primary', fontWeight: 'bold' }}>Address</TableCell>
                      {includeStats && (
                        <>
                          <TableCell sx={{ color: 'text.primary', fontWeight: 'bold' }}>Salespersons</TableCell>
                          <TableCell sx={{ color: 'text.primary', fontWeight: 'bold' }}>Estimates</TableCell>
                          <TableCell sx={{ color: 'text.primary', fontWeight: 'bold' }}>Revenue</TableCell>
                        </>
                      )}
                      <TableCell align="center" sx={{ color: 'text.primary', fontWeight: 'bold' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {branches.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={includeStats ? 7 : 4} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">
                            No branches found
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      branches.map((branch) => (
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
                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                              <Tooltip title="View details">
                                <IconButton
                                  size="small"
                                  onClick={() => openViewModal(branch)}
                                  disabled={loading}
                                >
                                  <ViewIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Edit">
                                <IconButton
                                  size="small"
                                  onClick={() => openEditModal(branch)}
                                  disabled={loading}
                                >
                                  <EditIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleDelete(branch)}
                                  disabled={loading}
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Pagination */}
              <TablePagination
                component="div"
                count={totalCount}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
                }}
                rowsPerPageOptions={[5, 10, 25, 50]}
                labelRowsPerPage="Rows per page:"
                labelDisplayedRows={({ from, to, count }) => 
                  `${from}-${to} of ${count !== -1 ? count : 'more than ' + to}`
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
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={!!formErrors.name}
              helperText={formErrors.name}
              disabled={submitLoading}
            />
            <TextField
              fullWidth
              label="Address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              multiline
              rows={3}
              disabled={submitLoading}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeModals} disabled={submitLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreate} 
            variant="contained" 
            disabled={submitLoading}
            startIcon={submitLoading ? <CircularProgress size={20} /> : null}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={editModalOpen} onClose={closeModals} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Branch</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={!!formErrors.name}
              helperText={formErrors.name}
              disabled={submitLoading}
            />
            <TextField
              fullWidth
              label="Address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              multiline
              rows={3}
              disabled={submitLoading}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeModals} disabled={submitLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpdate} 
            variant="contained" 
            disabled={submitLoading}
            startIcon={submitLoading ? <CircularProgress size={20} /> : null}
          >
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Modal */}
      <Dialog open={viewModalOpen} onClose={closeModals} maxWidth="md" fullWidth>
        <DialogTitle>Branch Details</DialogTitle>
        <DialogContent>
          {selectedBranch && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                {selectedBranch.name}
              </Typography>
              <Typography variant="body1" sx={{ mb: 3 }}>
                <strong>Address:</strong> {selectedBranch.address || 'N/A'}
              </Typography>
              
              {selectedBranch.stats && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>Statistics</Typography>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Chip
                      icon={<PeopleIcon />}
                      label={`${selectedBranch.stats.salesPersonsCount} Salespersons`}
                      color="primary"
                    />
                    <Chip
                      label={`${selectedBranch.stats.estimatesCount} Estimates`}
                      color="info"
                    />
                    <Chip
                      icon={<MoneyIcon />}
                      label={formatMoney(selectedBranch.stats.totalRevenue)}
                      color="success"
                    />
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

export default BranchesTab; 