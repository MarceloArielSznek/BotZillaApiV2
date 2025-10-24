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
  CardContent
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Label as LabelIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import statusService, { type EstimateStatus, type CreateStatusData, type UpdateStatusData, type StatusListResponse } from '../../services/statusService';

const StatusesTab = () => {
  // Estados principales
  const [statuses, setStatuses] = useState<EstimateStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Estados de paginación
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // Estados de modales
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<EstimateStatus | null>(null);

  // Estados de formularios
  const [formData, setFormData] = useState<CreateStatusData>({
    name: ''
  });
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [submitLoading, setSubmitLoading] = useState(false);

  // Cargar statuses
  useEffect(() => {
    loadStatuses();
  }, [page, rowsPerPage]);

  const loadStatuses = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await statusService.getStatuses({
        page: page + 1, // El backend usa 1-indexed, pero el frontend usa 0-indexed
        limit: rowsPerPage,
        includeStats: true
      });
      
      // Validación defensiva de la respuesta
      if (response && response.statuses && Array.isArray(response.statuses)) {
        setStatuses(response.statuses);
        setTotalCount(response.pagination?.totalCount || 0);
      } else {
        console.warn('Invalid response from getStatuses:', response);
        setStatuses([]);
        setTotalCount(0);
        setError('Invalid response format from server');
      }
    } catch (error: any) {
      setError('Error loading statuses: ' + (error.response?.data?.message || error.message || 'Unknown error'));
      setStatuses([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadStatuses();
  };

  // Funciones de modal
  const openCreateModal = () => {
    setFormData({ name: '' });
    setFormErrors({});
    setCreateModalOpen(true);
  };

  const openEditModal = (status: EstimateStatus) => {
    setFormData({
      name: status.name
    });
    setFormErrors({});
    setSelectedStatus(status);
    setEditModalOpen(true);
  };

  const closeModals = () => {
    setCreateModalOpen(false);
    setEditModalOpen(false);
    setSelectedStatus(null);
    setFormData({ name: '' });
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

  // Create status
  const handleCreate = async () => {
    if (!validateForm()) return;

    try {
      setSubmitLoading(true);
      await statusService.createStatus(formData);
      setSuccess('Status created successfully');
      closeModals();
      loadStatuses();
    } catch (error: any) {
      setError('Error creating status: ' + (error.message || 'Unknown error'));
    } finally {
      setSubmitLoading(false);
    }
  };

  // Update status
  const handleUpdate = async () => {
    if (!validateForm() || !selectedStatus) return;

    try {
      setSubmitLoading(true);
      await statusService.updateStatus(selectedStatus.id, formData);
      setSuccess('Status updated successfully');
      closeModals();
      loadStatuses();
    } catch (error: any) {
      setError('Error updating status: ' + (error.message || 'Unknown error'));
    } finally {
      setSubmitLoading(false);
    }
  };

  // Delete status
  const handleDelete = async (status: EstimateStatus) => {
    const estimatesCount = status.stats?.estimatesCount || 0;
    if (estimatesCount > 0) {
      setError(`Cannot delete status "${status.name}" because it has ${estimatesCount} estimate(s) associated`);
      return;
    }

    if (!window.confirm(`Are you sure you want to delete the status "${status.name}"?`)) {
      return;
    }

    try {
      setLoading(true);
      await statusService.deleteStatus(status.id);
      setSuccess('Status deleted successfully');
      loadStatuses();
    } catch (error: any) {
      setError('Error deleting status: ' + (error.response?.data?.message || error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (statusName: string) => {
    switch (statusName.toLowerCase()) {
      case 'active':
        return 'success';
      case 'pending':
        return 'warning';
      case 'completed':
        return 'info';
      case 'cancelled':
        return 'error';
      case 'released':
        return 'primary';
      default:
        return 'default';
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <LabelIcon sx={{ mr: 1, fontSize: 24 }} />
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
            Estimate Statuses Management
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
            New Status
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

      {/* Info Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            Estimate statuses define the different states that estimates can have throughout their lifecycle.
            Common statuses include: active, pending, completed, cancelled, and released.
          </Typography>
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
                      <TableCell sx={{ color: 'text.primary', fontWeight: 'bold' }}>Status Name</TableCell>
                      <TableCell sx={{ color: 'text.primary', fontWeight: 'bold' }}>Estimates Count</TableCell>
                      <TableCell align="center" sx={{ color: 'text.primary', fontWeight: 'bold' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {statuses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">
                            No statuses found
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      statuses.map((status) => (
                        <TableRow key={status.id} hover>
                          <TableCell>{status.id}</TableCell>
                          <TableCell>
                            <Chip
                              icon={<LabelIcon />}
                              label={status.name.charAt(0).toUpperCase() + status.name.slice(1)}
                              color={getStatusColor(status.name)}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={formatNumber(status.stats?.estimatesCount || 0)}
                              size="small"
                              color="info"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                              <Tooltip title="Edit">
                                <IconButton
                                  size="small"
                                  onClick={() => openEditModal(status)}
                                  disabled={loading}
                                >
                                  <EditIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleDelete(status)}
                                  disabled={loading || Boolean(status.stats?.estimatesCount && status.stats.estimatesCount > 0)}
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
        <DialogTitle>Create New Status</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Status Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={!!formErrors.name}
              helperText={formErrors.name || 'Enter a descriptive name for the status (e.g., active, pending, completed)'}
              disabled={submitLoading}
              placeholder="e.g., active, pending, completed"
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
        <DialogTitle>Edit Status</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Status Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={!!formErrors.name}
              helperText={formErrors.name || 'Enter a descriptive name for the status'}
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
    </Box>
  );
};

export default StatusesTab; 