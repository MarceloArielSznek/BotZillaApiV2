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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Chip,
  Divider,
  IconButton,
  Tooltip,
  Snackbar
} from '@mui/material';
import {
  Sync as SyncIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import estimateService, {
  type Estimate,
  type FetchEstimatesParams,
  type SyncEstimatesParams,
  type Branch,
  type SalesPerson,
  type EstimateStatus,
  type FetchEstimatesResponse,
  type SyncEstimatesResponse
} from '../services/estimateService';
import { format } from 'date-fns'; // Usaremos date-fns para un formateo robusto
import EstimateDetailsModal from '../components/estimates/EstimateDetailsModal';
import JobDetailsModal from '../components/jobs/JobDetailsModal';
import { getJobById } from '../services/jobService';
import EstimateFormModal from '../components/estimates/EstimateFormModal';

const Estimates: React.FC = () => {
  // Estados principales
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedEstimateId, setSelectedEstimateId] = useState<number | null>(null);
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  
  // Estados para edición y eliminación
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [estimateToEdit, setEstimateToEdit] = useState<Estimate | null>(null);
  const [estimateToDelete, setEstimateToDelete] = useState<Estimate | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  // Estados de paginación
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // Estados de filtros
  const [branches, setBranches] = useState<Branch[]>([]);
  const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([]);
  const [statuses, setStatuses] = useState<EstimateStatus[]>([]);
  
  const [filters, setFilters] = useState<FetchEstimatesParams>({
    page: 1,
    limit: 10,
    branch: undefined,
    salesperson: undefined,
    status: undefined,
    startDate: '',
    endDate: '',
    search: '' // Nuevo campo de búsqueda
  });

  // Estados del modal de sync
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncFilters, setSyncFilters] = useState<SyncEstimatesParams>({
    branchId: undefined,
    statusId: undefined,
    startDate: '',
    endDate: ''
  });

  // Unificar notificaciones en un solo objeto
  const [notification, setNotification] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  // Cargar datos iniciales (solo se ejecuta una vez)
  useEffect(() => {
    loadInitialData();
  }, []);

  // Recargar la lista de salespersons cuando el filtro de branch cambie
  useEffect(() => {
    const fetchSalesPersonsForBranch = async () => {
      try {
        setLoading(true);
        // Si hay una branch seleccionada, pedimos los salespersons de esa branch
        // Si no, pedimos todos (sin filtro de branch)
        const salesPersonsData = await estimateService.getSalesPersons(
          filters.branch ? { branchId: filters.branch } : {}
        );
        setSalesPersons(Array.isArray(salesPersonsData) ? salesPersonsData : []);
      } catch (error: any) {
        setError('Error loading salespersons: ' + (error.response?.data?.message || error.message));
      } finally {
        setLoading(false);
      }
    };

    fetchSalesPersonsForBranch();
  }, [filters.branch]);


  // Cargar estimates cuando cambien los filtros o paginación
  // Debounce para loadEstimates: esperar 500ms después de cambios en filters.search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadEstimates();
    }, filters.search ? 500 : 0); // Si hay búsqueda, esperar 500ms; si no, cargar inmediatamente
    
    return () => clearTimeout(timeoutId);
  }, [filters, page, rowsPerPage]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      // En la carga inicial, no filtramos salespersons por branch
      const [branchesData, salesPersonsData, statusesData] = await Promise.all([
        estimateService.getBranches(),
        estimateService.getSalesPersons({}),
        estimateService.getEstimateStatuses()
      ]);
      
      // Manejo defensivo de los datos iniciales
      setBranches(Array.isArray(branchesData) ? branchesData : []);
      setSalesPersons(Array.isArray(salesPersonsData) ? salesPersonsData : []);
      setStatuses(Array.isArray(statusesData) ? statusesData : []);
    } catch (error: any) {
      setError('Error loading initial data: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const loadEstimates = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params: FetchEstimatesParams = {
        ...filters,
        page: page + 1,
        limit: rowsPerPage,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined
      };

      const response: FetchEstimatesResponse = await estimateService.fetchEstimates(params);
      
      // Manejo defensivo de la respuesta
      if (response && typeof response === 'object') {
        setEstimates(response.data || []);
        setTotalCount(response.total || 0);
      } else {
        console.warn('Unexpected response from fetchEstimates:', response);
        setEstimates([]);
        setTotalCount(0);
      }
    } catch (error: any) {
      setError('Error loading estimates: ' + (error.response?.data?.message || error.message));
      setEstimates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field: keyof FetchEstimatesParams, value: any) => {
    setFilters(prev => ({
      ...prev,
      [field]: value === '' ? undefined : value
    }));
    // Limpiar también el filtro de salesperson si se limpia el de branch
    if (field === 'branch' && !value) {
      setFilters(prev => ({
        ...prev,
        salesperson: undefined
      }));
    }
    setPage(0); // Reset to first page when filtering
  };

  const handlePageChange = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSyncFiltersChange = (field: keyof SyncEstimatesParams, value: any) => {
    setSyncFilters(prev => ({
      ...prev,
      [field]: value === '' ? undefined : value
    }));
  };

  const handleSync = async (filters: any) => {
    setSyncLoading(true);
    setNotification(null);
    
    // Log de los filtros que se van a enviar
    console.log('🔍 Frontend - Filtros de sync a enviar:', {
      filters: filters,
      hasStartDate: !!filters.startDate,
      hasEndDate: !!filters.endDate,
      startDate: filters.startDate,
      endDate: filters.endDate
    });
    
    try {
      const result = await estimateService.syncEstimates(filters);
      setNotification({ message: result.message, severity: 'success' });
      loadEstimates(); // Refrescar la tabla de fondo
    } catch (err: any) {
      setNotification({ message: err.response?.data?.message || 'Ocurrió un error inesperado.', severity: 'error' });
    } finally {
      setSyncLoading(false);
      setSyncModalOpen(false); // Cierra el modal al finalizar, tanto en éxito como en error
    }
  };

  const clearFilters = () => {
    setFilters({
      page: 1,
      limit: rowsPerPage,
      branch: undefined,
      salesperson: undefined,
      status: undefined,
      startDate: '',
      endDate: '',
      search: ''
    });
    setPage(0);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'activo':
        return 'success';
      case 'pending':
      case 'pendiente':
        return 'warning';
      case 'cancelled':
      case 'cancelado':
        return 'error';
      default:
        return 'default';
    }
  };

  const renderCell = (value: any) => value || 'N/A';

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MM/dd/yyyy');
    } catch {
      return 'Invalid Date';
    }
  };

  // Funciones para manejar acciones
  const handleEditEstimate = (estimate: Estimate) => {
    setEstimateToEdit(estimate);
    setEditModalOpen(true);
  };

  const handleUpdateEstimate = async (estimateData: Partial<Estimate>) => {
    if (!estimateToEdit) return;
    
    try {
      setEditLoading(true);
      await estimateService.updateEstimate(estimateToEdit.id, estimateData);
      
      // Recargar la lista de estimates
      await loadEstimates();
      
      // Cerrar el modal
      setEditModalOpen(false);
      setEstimateToEdit(null);
      
      setSuccessMessage('Estimate updated successfully');
    } catch (error: any) {
      setError('Error updating estimate: ' + (error.response?.data?.message || error.message));
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteEstimate = (estimate: Estimate) => {
    setEstimateToDelete(estimate);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteEstimate = async () => {
    if (!estimateToDelete) return;
    
    try {
      setLoading(true);
      await estimateService.deleteEstimate(estimateToDelete.id);
      setNotification({ message: 'Estimate deleted successfully', severity: 'success' });
      loadEstimates(); // Recargar la lista
      setDeleteDialogOpen(false);
      setEstimateToDelete(null);
    } catch (error: any) {
      setNotification({ 
        message: 'Error deleting estimate: ' + (error.response?.data?.message || error.message), 
        severity: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Estimates
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Tooltip title="Actualizar datos">
            <IconButton onClick={loadEstimates} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<SyncIcon />}
            onClick={() => setSyncModalOpen(true)}
            disabled={loading}
            sx={{ bgcolor: 'primary.main' }}
          >
            Sync with Attic Tech
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
      {syncResult && (
        <Snackbar
          open={!!syncResult}
          autoHideDuration={6000}
          onClose={() => setSyncResult(null)}
          message={syncResult}
        />
      )}

      {/* Filtros */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Filters</Typography>
            <Button
              size="small"
              onClick={clearFilters}
              sx={{ ml: 'auto' }}
            >
              Clear filters
            </Button>
          </Box>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
            <TextField
              sx={{ flex: '1 1 200px' }}
              label="Search estimates..."
              value={filters.search || ''}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              size="small"
              InputProps={{
                startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />
              }}
              placeholder="Search by name, salesperson, or branch"
            />
            <FormControl fullWidth size="small" sx={{ flex: '1 1 150px' }}>
              <InputLabel>Branch</InputLabel>
              <Select
                value={filters.branch || ''}
                onChange={(e) => handleFilterChange('branch', e.target.value)}
                label="Branch"
              >
                <MenuItem value=""><em>All Branches</em></MenuItem>
                {branches && branches.map((branch) => (
                  <MenuItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small" sx={{ flex: '1 1 150px' }}>
              <InputLabel>Salesperson</InputLabel>
              <Select
                value={filters.salesperson || ''}
                onChange={(e) => handleFilterChange('salesperson', e.target.value)}
                label="Salesperson"
              >
                <MenuItem value=""><em>All Salespersons</em></MenuItem>
                {salesPersons && salesPersons.map((person) => (
                  <MenuItem key={person.id} value={person.id}>
                    {person.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small" sx={{ flex: '1 1 150px' }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={filters.status || ''}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                label="Status"
              >
                <MenuItem value=""><em>All Statuses</em></MenuItem>
                {statuses && statuses.map((status) => (
                  <MenuItem key={status.id} value={status.id}>
                    {status.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField 
              sx={{ flex: '1 1 150px' }} 
              type="date" 
              value={filters.startDate} 
              onChange={(e) => handleFilterChange('startDate', e.target.value)} 
              InputLabelProps={{ shrink: true }} 
              label="From Date" 
              size="small" 
            />
            <TextField 
              sx={{ flex: '1 1 150px' }} 
              type="date" 
              value={filters.endDate} 
              onChange={(e) => handleFilterChange('endDate', e.target.value)} 
              InputLabelProps={{ shrink: true }} 
              label="To Date" 
              size="small" 
            />
            <Button 
              variant="outlined" 
              onClick={clearFilters}
            >
              Clear
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <TableContainer component={Paper}>
                <Table sx={{ minWidth: 650 }} aria-label="estimates table">
                  <TableHead>
                    <TableRow>
                      {/* <TableCell sx={{ fontWeight: 'bold' }}>ID</TableCell> */}
                      <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Branch</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Salesperson</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Final Price</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Discount</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Hours</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Dates</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {estimates.map((estimate) => (
                      <TableRow 
                        key={estimate.id} 
                        hover
                        onClick={() => { setSelectedEstimateId(estimate.id); setDetailsOpen(true); }}
                        sx={{ 
                          cursor: 'pointer',
                          '&:last-child td, &:last-child th': { border: 0 }
                        }}
                      >
                        {/* <TableCell>{estimate.id}</TableCell> */}
                        <TableCell component="th" scope="row">
                          {estimate.name}
                        </TableCell>
                        <TableCell>{renderCell(estimate.Branch?.name)}</TableCell>
                        <TableCell>{renderCell(estimate.SalesPerson?.name)}</TableCell>
                        <TableCell>
                          <Chip
                            label={renderCell(estimate.EstimateStatus?.name)}
                            color={getStatusColor(renderCell(estimate.EstimateStatus?.name))}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {estimate.final_price != null ? formatPrice(Number(estimate.final_price)) : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {estimate.discount != null ? `${parseFloat(String(estimate.discount)).toFixed(2)}%` : '0.00%'}
                        </TableCell>
                        <TableCell>
                          {estimate.attic_tech_hours != null ? `${Number(estimate.attic_tech_hours).toFixed(2)}h` : 'N/A'}
                        </TableCell>
                        <TableCell>
                            <Typography variant="body2" sx={{ display: 'block' }}>
                                AT Created: {formatDate(estimate.at_created_date)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                AT Updated: {formatDate(estimate.at_updated_date)}
                            </Typography>
                        </TableCell>
                        <TableCell sx={{ textAlign: 'center' }}>
                          <Tooltip title="Edit estimate">
                            <IconButton
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditEstimate(estimate);
                              }}
                              size="small"
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete estimate">
                            <IconButton
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteEstimate(estimate);
                              }}
                              size="small"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                    {estimates.length === 0 && !loading && (
                      <TableRow>
                        <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                          <Typography variant="body1" color="text.secondary">
                            No estimates found with applied filters
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                rowsPerPageOptions={[10, 25, 50, 100]}
                component="div"
                count={totalCount}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handlePageChange}
                onRowsPerPageChange={handleRowsPerPageChange}
                labelRowsPerPage="Rows per page:"
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Sync Modal */}
      <Dialog
        open={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <SyncIcon sx={{ mr: 1 }} />
            Sync Estimates from Attic Tech
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Select filters to sync specific estimates. If no filters are provided, the last 7 days will be synced.
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Branch</InputLabel>
                <Select
                  value={syncFilters.branchId || ''}
                  onChange={(e) => handleSyncFiltersChange('branchId', e.target.value)}
                  label="Branch"
                >
                  <MenuItem value="">
                    <em>All</em>
                  </MenuItem>
                  {branches && branches.map((branch) => (
                    <MenuItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={syncFilters.statusId || ''}
                  onChange={(e) => handleSyncFiltersChange('statusId', e.target.value)}
                  label="Status"
                >
                  <MenuItem value="">
                    <em>All</em>
                  </MenuItem>
                  {statuses.map((status) => (
                    <MenuItem key={status.id} value={status.id}>
                      {status.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            <TextField
              fullWidth
              type="date"
              label="From date"
              value={syncFilters.startDate}
              onChange={(e) => handleSyncFiltersChange('startDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              fullWidth
              type="date"
              label="To date"
              value={syncFilters.endDate}
              onChange={(e) => handleSyncFiltersChange('endDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setSyncModalOpen(false)}
            disabled={syncLoading}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => handleSync(syncFilters)}
            disabled={syncLoading}
            startIcon={syncLoading ? <CircularProgress size={20} /> : <SyncIcon />}
          >
            {syncLoading ? 'Syncing...' : 'Sync Now'}
          </Button>
        </DialogActions>
      </Dialog>
      
      <Snackbar
        open={!!notification}
        autoHideDuration={6000}
        onClose={() => setNotification(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setNotification(null)} 
          severity={notification?.severity || 'info'} 
          sx={{ width: '100%' }}
        >
          {notification?.message}
        </Alert>
      </Snackbar>

      {/* Estimate Details Modal */}
      <EstimateDetailsModal
        estimateId={selectedEstimateId}
        open={detailsOpen}
        onClose={() => { setDetailsOpen(false); setSelectedEstimateId(null); }}
      />

      {/* Job Details Modal */}
      <JobDetailsModal
        jobId={selectedJobId}
        open={jobModalOpen}
        onClose={() => { setJobModalOpen(false); setSelectedJobId(null); }}
      />

      {/* Edit Estimate Modal */}
      <EstimateFormModal
        open={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEstimateToEdit(null);
        }}
        onSubmit={handleUpdateEstimate}
        estimate={estimateToEdit || undefined}
        loading={editLoading}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Confirm Delete
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the estimate "{estimateToDelete?.name}"? 
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmDeleteEstimate}
            color="error"
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            {loading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>


    </Box>
  );
};

export default Estimates; 