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
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import estimateService, {
  type Estimate,
  type FetchEstimatesParams,
  type Branch,
  type SalesPerson,
  type EstimateStatus,
} from '../services/estimateService';
import { api } from '../config/api';
import { format } from 'date-fns';
import EstimateDetailsModal from '../components/estimates/EstimateDetailsModal';

const FollowUpEstimates: React.FC = () => {
  // Estados principales
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedEstimateId, setSelectedEstimateId] = useState<number | null>(null);

  // Estados de paginación
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalEstimates, setTotalEstimates] = useState(0);

  // Estados de filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<number | ''>('');
  const [selectedSalesperson, setSelectedSalesperson] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [lostStatusId, setLostStatusId] = useState<number | null>(null);

  // Listas para filtros
  const [branches, setBranches] = useState<Branch[]>([]);
  const [salespeople, setSalespeople] = useState<SalesPerson[]>([]);

  // Cargar datos iniciales (branches, salespeople, lost status)
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        
        // Cargar statuses, branches y salespeople en paralelo
        const [statusesData, branchesData, salespeopleData] = await Promise.all([
          estimateService.getEstimateStatuses(),
          estimateService.getBranches(),
          estimateService.getSalesPersons({}),
        ]);

        // Encontrar el ID del status "Lost"
        const lostStatus = statusesData.find(
          (status: EstimateStatus) => status.name.toLowerCase() === 'lost'
        );
        
        if (lostStatus) {
          setLostStatusId(lostStatus.id);
        } else {
          console.error('Lost status not found in the system');
          setError('Lost status not found in the system');
        }

        setBranches(Array.isArray(branchesData) ? branchesData : []);
        setSalespeople(Array.isArray(salespeopleData) ? salespeopleData : []);
      } catch (err) {
        console.error('Error loading initial data:', err);
        setError('Failed to load filters data');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  const fetchEstimates = async () => {
    if (!lostStatusId) return;
    
    try {
      setLoading(true);
      setError(null);

      const params: FetchEstimatesParams = {
        page: page + 1,
        limit: rowsPerPage,
        status: lostStatusId, // Solo traer estimates con status "Lost"
        search: searchQuery || undefined,
        branch: selectedBranch || undefined,
        salesperson: selectedSalesperson || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };

      const response = await estimateService.fetchEstimates(params);
      setEstimates(response.data);
      setTotalEstimates(response.total);
    } catch (err) {
      console.error('Error fetching estimates:', err);
      setError('Failed to load estimates');
    } finally {
      setLoading(false);
    }
  };

  // Cargar estimates cuando cambian los filtros o la paginación
  useEffect(() => {
    fetchEstimates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage, lostStatusId]);

  const handleSearch = () => {
    setPage(0);
    fetchEstimates();
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedBranch('');
    setSelectedSalesperson('');
    setStartDate('');
    setEndDate('');
    setPage(0);
    // Recargar estimates después de limpiar filtros
    setTimeout(() => {
      if (lostStatusId) {
        fetchEstimates();
      }
    }, 0);
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleViewDetails = (estimateId: number) => {
    setSelectedEstimateId(estimateId);
    setDetailsOpen(true);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MM/dd/yyyy');
    } catch {
      return 'Invalid Date';
    }
  };

  const formatCurrency = (value: number | string | null) => {
    if (value === null || value === undefined) return '$0.00';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(numValue);
  };

  const formatHours = (hours: number | string | null) => {
    if (hours === null || hours === undefined) return '0.00h';
    const numHours = typeof hours === 'string' ? parseFloat(hours) : hours;
    return `${numHours.toFixed(2)}h`;
  };

  return (
    <Box sx={{ minHeight: 'calc(100vh - 64px)', backgroundColor: 'background.default' }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Lost Estimates
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchEstimates}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Filters</Typography>
            <Button
              size="small"
              onClick={handleClearFilters}
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="small"
              InputProps={{
                startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />
              }}
              placeholder="Search by name, salesperson, or branch"
            />
            <FormControl fullWidth size="small" sx={{ flex: '1 1 150px' }}>
              <InputLabel>Branch</InputLabel>
              <Select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value as number | '')}
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
                value={selectedSalesperson}
                onChange={(e) => setSelectedSalesperson(e.target.value as number | '')}
                label="Salesperson"
              >
                <MenuItem value=""><em>All Salespersons</em></MenuItem>
                {salespeople && salespeople.map((person) => (
                  <MenuItem key={person.id} value={person.id}>
                    {person.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField 
              sx={{ flex: '1 1 150px' }} 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              InputLabelProps={{ shrink: true }} 
              label="From Date" 
              size="small" 
            />
            <TextField 
              sx={{ flex: '1 1 150px' }} 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              InputLabelProps={{ shrink: true }} 
              label="To Date" 
              size="small" 
            />
            <Button 
              variant="outlined" 
              onClick={handleClearFilters}
            >
              Clear
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

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
                <Table sx={{ minWidth: 650 }} aria-label="estimates table">
                  <TableHead>
                    <TableRow>
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
                        onClick={() => handleViewDetails(estimate.id)}
                        sx={{ 
                          cursor: 'pointer',
                          '&:last-child td, &:last-child th': { border: 0 }
                        }}
                      >
                        <TableCell component="th" scope="row">
                          {estimate.name}
                        </TableCell>
                        <TableCell>{estimate.Branch?.name || 'N/A'}</TableCell>
                        <TableCell>{estimate.SalesPerson?.name || 'N/A'}</TableCell>
                        <TableCell>
                          <Chip
                            label="Lost"
                            color="error"
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {estimate.final_price != null ? formatCurrency(Number(estimate.final_price)) : 'N/A'}
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
                          <Tooltip title="View details">
                            <IconButton
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewDetails(estimate.id);
                              }}
                              size="small"
                            >
                              <VisibilityIcon />
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
                count={totalEstimates}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                labelRowsPerPage="Rows per page:"
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Details Modal */}
      <EstimateDetailsModal
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        estimateId={selectedEstimateId}
      />
    </Box>
  );
};

export default FollowUpEstimates;

