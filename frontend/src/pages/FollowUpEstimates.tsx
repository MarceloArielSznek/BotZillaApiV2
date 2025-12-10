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
  Checkbox,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  Clear as ClearIcon,
  Download as DownloadIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';
import estimateService, {
  type Estimate,
  type FetchEstimatesParams,
  type Branch,
  type SalesPerson,
  type EstimateStatus,
} from '../services/estimateService';
import followUpTicketService from '../services/followUpTicketService';
import smsBatchService from '../services/smsBatchService';
import { api } from '../config/api';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import EstimateDetailsModal from '../components/estimates/EstimateDetailsModal';
import MailchimpExportModal from '../components/estimates/MailchimpExportModal';
import FollowUpTicketModal from '../components/followUp/FollowUpTicketModal';

const FollowUpEstimates: React.FC = () => {
  const navigate = useNavigate();
  // Estados principales
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedEstimateId, setSelectedEstimateId] = useState<number | null>(null);
  const [mailchimpExportOpen, setMailchimpExportOpen] = useState(false);
  const [followUpTicketOpen, setFollowUpTicketOpen] = useState(false);
  const [selectedEstimateForTicket, setSelectedEstimateForTicket] = useState<Estimate | null>(null);
  const [selectedEstimatesForBatch, setSelectedEstimatesForBatch] = useState<Set<number>>(new Set());

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
  const [selectedFollowUpStatus, setSelectedFollowUpStatus] = useState<number | ''>('');
  const [selectedFollowUpLabel, setSelectedFollowUpLabel] = useState<number | ''>('');
  const [followUpDate, setFollowUpDate] = useState('');

  // Listas para filtros
  const [branches, setBranches] = useState<Branch[]>([]);
  const [salespeople, setSalespeople] = useState<SalesPerson[]>([]);
  const [followUpStatuses, setFollowUpStatuses] = useState<any[]>([]);
  const [followUpLabels, setFollowUpLabels] = useState<any[]>([]);

  // Cargar datos iniciales (branches, salespeople, lost status)
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        setError(null); // Limpiar errores previos
        
        // Cargar statuses, branches, salespeople y follow-up data en paralelo
        const [statusesData, branchesData, salespeopleData, followUpStatusesData, followUpLabelsData] = await Promise.all([
          estimateService.getEstimateStatuses().catch(err => {
            console.error('Error fetching statuses:', err);
            return [];
          }),
          estimateService.getBranches().catch(err => {
            console.error('Error fetching branches:', err);
            return [];
          }),
          estimateService.getSalesPersons({}).catch(err => {
            console.error('Error fetching salespeople:', err);
            return [];
          }),
          followUpTicketService.getAllStatuses().catch(err => {
            console.error('Error fetching follow-up statuses:', err);
            return [];
          }),
          followUpTicketService.getAllLabels().catch(err => {
            console.error('Error fetching follow-up labels:', err);
            return [];
          }),
        ]);

        console.log('📊 Loaded initial data:', {
          statusesCount: statusesData?.length || 0,
          branchesCount: branchesData?.length || 0,
          salespeopleCount: salespeopleData?.length || 0,
          statuses: statusesData?.map(s => s.name) || []
        });

        // Encontrar el ID del status "Lost"
        if (!statusesData || statusesData.length === 0) {
          console.error('❌ No statuses received from API');
          setError('No statuses available. Please check your connection and try refreshing the page.');
          setLoading(false);
          return;
        }
        
        const lostStatus = statusesData.find(
          (status: EstimateStatus) => status.name.toLowerCase() === 'lost'
        );
        
        if (lostStatus) {
          console.log('✅ Found Lost status:', lostStatus);
          setLostStatusId(lostStatus.id);
        } else {
          const availableStatuses = statusesData.map(s => s.name).join(', ');
          console.error('❌ Lost status not found. Available statuses:', availableStatuses);
          setError(`Lost status not found in the system. Available statuses: ${availableStatuses}. Please contact support.`);
        }

        setBranches(Array.isArray(branchesData) ? branchesData : []);
        setSalespeople(Array.isArray(salespeopleData) ? salespeopleData : []);
        setFollowUpStatuses(Array.isArray(followUpStatusesData) ? followUpStatusesData : []);
        setFollowUpLabels(Array.isArray(followUpLabelsData) ? followUpLabelsData : []);
      } catch (err: any) {
        console.error('❌ Error loading initial data:', err);
        setError(`Failed to load filters data: ${err.message || 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  const fetchEstimates = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: FetchEstimatesParams = {
        page: page + 1,
        limit: rowsPerPage,
        // No enviamos status porque el endpoint /lost ya filtra por "Lost"
        search: searchQuery || undefined,
        branch: selectedBranch || undefined,
        salesperson: selectedSalesperson || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        followUpStatus: selectedFollowUpStatus || undefined,
        followUpLabel: selectedFollowUpLabel || undefined,
        followUpDate: followUpDate || undefined,
      };

      const response = await estimateService.fetchLostEstimates(params);
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
  }, [page, rowsPerPage, selectedFollowUpStatus, selectedFollowUpLabel, followUpDate]);

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
    setSelectedFollowUpStatus('');
    setSelectedFollowUpLabel('');
    setFollowUpDate('');
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
        <Box sx={{ display: 'flex', gap: 2 }}>
          {(() => {
            const addToBatchId = localStorage.getItem('addToBatchId');
            const isAddingToBatch = !!addToBatchId;
            
            if (selectedEstimatesForBatch.size > 0) {
              if (isAddingToBatch) {
                return (
                  <Button
                    variant="contained"
                    color="success"
                    onClick={async () => {
                      try {
                        const estimateIds = Array.from(selectedEstimatesForBatch);
                        await smsBatchService.addEstimatesToBatch(parseInt(addToBatchId!), estimateIds);
                        localStorage.removeItem('selectedEstimatesForBatch');
                        localStorage.removeItem('addToBatchId');
                        setSelectedEstimatesForBatch(new Set());
                        // Opcional: mostrar mensaje de éxito
                        navigate(`/follow-up/sms-batches/${addToBatchId}`);
                      } catch (err: any) {
                        console.error('Error adding estimates to batch:', err);
                        // Mostrar error
                      }
                    }}
                  >
                    Add to Batch ({selectedEstimatesForBatch.size})
                  </Button>
                );
              } else {
                return (
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => {
                      // Guardar en localStorage para que CreateSmsBatch pueda acceder
                      localStorage.setItem('selectedEstimatesForBatch', JSON.stringify(Array.from(selectedEstimatesForBatch)));
                      navigate('/follow-up/sms-batches/create?method=manual');
                    }}
                  >
                    Create Batch ({selectedEstimatesForBatch.size})
                  </Button>
                );
              }
            }
            return null;
          })()}
          <Button
            variant="contained"
            color="success"
            startIcon={<DownloadIcon />}
            onClick={() => setMailchimpExportOpen(true)}
          >
            Export for Mailchimp
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchEstimates}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>
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
            <FormControl fullWidth size="small" sx={{ flex: '1 1 150px' }}>
              <InputLabel>Follow-Up Status</InputLabel>
              <Select
                value={selectedFollowUpStatus}
                onChange={(e) => setSelectedFollowUpStatus(e.target.value as number | '')}
                label="Follow-Up Status"
              >
                <MenuItem value=""><em>All Statuses</em></MenuItem>
                {followUpStatuses && followUpStatuses.map((status) => (
                  <MenuItem key={status.id} value={status.id}>
                    {status.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small" sx={{ flex: '1 1 150px' }}>
              <InputLabel>Follow-Up Label</InputLabel>
              <Select
                value={selectedFollowUpLabel}
                onChange={(e) => setSelectedFollowUpLabel(e.target.value as number | '')}
                label="Follow-Up Label"
              >
                <MenuItem value=""><em>All Labels</em></MenuItem>
                {followUpLabels && followUpLabels.map((label) => (
                  <MenuItem key={label.id} value={label.id}>
                    {label.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField 
              sx={{ flex: '1 1 150px' }} 
              type="date" 
              value={followUpDate} 
              onChange={(e) => setFollowUpDate(e.target.value)} 
              InputLabelProps={{ shrink: true }} 
              label="Follow-Up Date" 
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
                      <TableCell padding="checkbox" sx={{ width: 50 }}>
                        <Checkbox
                          checked={estimates.length > 0 && estimates.every(e => selectedEstimatesForBatch.has(e.id))}
                          indeterminate={selectedEstimatesForBatch.size > 0 && selectedEstimatesForBatch.size < estimates.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedEstimatesForBatch(new Set(estimates.map(e => e.id)));
                            } else {
                              setSelectedEstimatesForBatch(new Set());
                            }
                          }}
                          size="small"
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Branch</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Salesperson</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Costs</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Details</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Prices</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Hours</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Dates</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Follow Up</TableCell>
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
                        <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedEstimatesForBatch.has(estimate.id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              const newSelected = new Set(selectedEstimatesForBatch);
                              if (e.target.checked) {
                                newSelected.add(estimate.id);
                              } else {
                                newSelected.delete(estimate.id);
                              }
                              setSelectedEstimatesForBatch(newSelected);
                            }}
                            size="small"
                          />
                        </TableCell>
                        <TableCell component="th" scope="row">
                          {estimate.name}
                        </TableCell>
                        <TableCell>{estimate.Branch?.name || 'N/A'}</TableCell>
                        <TableCell>{estimate.SalesPerson?.name || 'N/A'}</TableCell>
                        
                        {/* Costs Column */}
                        <TableCell>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 160 }}>
                            {(() => {
                              const trueCost = estimate.price != null ? Number(estimate.price) : 0;
                              const subRetailCost = estimate.sub_service_retail_cost != null ? Number(estimate.sub_service_retail_cost) : 0;
                              const subFactor = estimate.sub_multiplier || 1.75; // Default sub multiplier
                              const hasSubServices = subRetailCost > 0;
                              
                              // Calculate separated costs
                              const subMaterialBase = hasSubServices ? subRetailCost / subFactor : 0;
                              const trueCostNonSub = hasSubServices ? trueCost - subMaterialBase : trueCost;
                              
                              return (
                                <>
                                  {hasSubServices ? (
                                    <>
                                      <Typography variant="caption" sx={{ color: 'success.main', fontSize: '0.7rem', fontWeight: 600 }}>
                                        True Cost (Non-Sub): {formatCurrency(trueCostNonSub)}
                                      </Typography>
                                      <Typography variant="caption" sx={{ color: 'info.main', fontSize: '0.7rem', fontWeight: 600 }}>
                                        Sub Price: {formatCurrency(subMaterialBase)}
                                      </Typography>
                                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', mt: 0.5 }}>
                                        Total: {formatCurrency(trueCost)}
                                      </Typography>
                                    </>
                                  ) : (
                                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                                      True Cost: {formatCurrency(trueCost)}
                                    </Typography>
                                  )}
                                </>
                              );
                            })()}
                            {estimate.PaymentMethod && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                                  Payment:
                                </Typography>
                                <Chip
                                  label={estimate.PaymentMethod.name}
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                  sx={{ 
                                    height: 18, 
                                    fontSize: '0.65rem',
                                    textTransform: 'capitalize'
                                  }}
                                />
                              </Box>
                            )}
                            {estimate.discount != null && estimate.discount > 0 && (
                              <Typography variant="caption" sx={{ color: 'error.main', fontSize: '0.7rem', fontWeight: 600 }}>
                                Discount: -{parseFloat(String(estimate.discount)).toFixed(1)}%
                              </Typography>
                            )}
                          </Box>
                        </TableCell>

                        {/* Details Column */}
                        <TableCell>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 140 }}>
                            {estimate.calculated_multiplier != null && (
                              <Box>
                                <Typography variant="caption" sx={{ color: 'success.main', fontSize: '0.7rem', fontWeight: 600 }}>
                                  Multiplier: {estimate.calculated_multiplier}x
                                </Typography>
                              </Box>
                            )}
                            
                            {/* Effective Multiplier (real after discount) */}
                            {(() => {
                              const trueCost = estimate.price != null ? Number(estimate.price) : 0;
                              const finalPrice = estimate.final_price != null ? Number(estimate.final_price) : 0;
                              const retailCost = estimate.retail_cost != null ? Number(estimate.retail_cost) : 0;
                              const subRetailCost = estimate.sub_service_retail_cost != null ? Number(estimate.sub_service_retail_cost) : 0;
                              const paymentMethodFactor = estimate.payment_method_factor || 1.065;
                              const subFactor = estimate.sub_multiplier || 1.75;
                              const hasSubServices = subRetailCost > 0;
                              
                              // Calculate true cost non-sub
                              const subMaterialBase = hasSubServices ? subRetailCost / subFactor : 0;
                              const trueCostNonSub = hasSubServices ? trueCost - subMaterialBase : trueCost;
                              
                              // Calculate effective multiplier working backwards from final price
                              if (trueCostNonSub > 0 && finalPrice > 0 && retailCost > 0) {
                                // 1. Remove payment method factor from both final and retail
                                const finalBeforePM = finalPrice / paymentMethodFactor;
                                const retailBeforePM = retailCost / paymentMethodFactor;
                                
                                // 2. Calculate what portion of the retail was Non-Sub
                                const nonSubRetailOriginal = retailBeforePM - subRetailCost;
                                const nonSubPercentage = nonSubRetailOriginal / retailBeforePM;
                                
                                // 3. Apply the same percentage to the final price (discount distributed proportionally)
                                const nonSubRetailEffective = finalBeforePM * nonSubPercentage;
                                
                                // 4. Calculate effective multiplier
                                const effectiveMultiplier = nonSubRetailEffective / trueCostNonSub;
                                
                                // Only show if different from theoretical multiplier (more than 0.05 difference)
                                const theoreticalMultiplier = estimate.calculated_multiplier || 0;
                                const difference = Math.abs(effectiveMultiplier - theoreticalMultiplier);
                                
                                if (difference > 0.05) {
                                  return (
                                    <Typography variant="caption" sx={{ color: 'warning.main', fontSize: '0.7rem', fontWeight: 600 }}>
                                      Effective: {effectiveMultiplier.toFixed(2)}x
                                    </Typography>
                                  );
                                }
                              }
                              return null;
                            })()}
                            
                            {estimate.sub_multiplier != null && estimate.sub_service_retail_cost != null && estimate.sub_service_retail_cost > 0 && (
                              <Typography variant="caption" sx={{ color: 'secondary.main', fontSize: '0.7rem', fontWeight: 600 }}>
                                Sub Multi: {estimate.sub_multiplier}x
                              </Typography>
                            )}
                            {estimate.payment_method_factor != null && (
                              <Typography variant="caption" sx={{ color: 'primary.main', fontSize: '0.7rem' }}>
                                PM Factor: {estimate.payment_method_factor}x
                              </Typography>
                            )}
                          </Box>
                        </TableCell>

                        {/* Prices Column */}
                        <TableCell>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 140 }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                              Retail Price:
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                              {estimate.retail_cost != null ? formatCurrency(Number(estimate.retail_cost)) : 'N/A'}
                            </Typography>
                            {estimate.discount != null && estimate.discount > 0 && (
                              <>
                                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', mt: 0.5 }}>
                                  After Discount:
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                  {estimate.final_price != null ? formatCurrency(Number(estimate.final_price)) : 'N/A'}
                                </Typography>
                              </>
                            )}
                            {estimate.total_tax_amount != null && estimate.total_tax_amount > 0 && (
                              <>
                                <Typography variant="caption" sx={{ color: 'info.main', fontSize: '0.7rem', mt: 0.5 }}>
                                  + Taxes ({(estimate.total_tax_rate! * 100).toFixed(2)}%):
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem', color: 'info.main' }}>
                                  {formatCurrency(Number(estimate.total_tax_amount))}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', mt: 0.5 }}>
                                  Final w/ Taxes:
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.95rem', color: 'primary.main' }}>
                                  {estimate.price_after_taxes != null ? formatCurrency(Number(estimate.price_after_taxes)) : 'N/A'}
                                </Typography>
                              </>
                            )}
                          </Box>
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
                        <TableCell>
                          {estimate.followUpTicket && 
                           (estimate.followUpTicket.followed_up || 
                            (estimate.followUpTicket.status && estimate.followUpTicket.status.name === 'Pending FU')) ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 140 }}>
                              {estimate.followUpTicket.status && (
                                <Chip
                                  label={estimate.followUpTicket.status.name}
                                  size="small"
                                  sx={{
                                    backgroundColor: estimate.followUpTicket.status.color || '#6B7280',
                                    color: 'white',
                                    fontSize: '0.75rem',
                                    height: 24,
                                    fontWeight: 600,
                                    width: 'fit-content'
                                  }}
                                />
                              )}
                              {/* Solo mostrar label y fecha si followed_up es true */}
                              {estimate.followUpTicket.followed_up && (
                                <>
                                  {estimate.followUpTicket.label && (
                                    <Chip
                                      label={estimate.followUpTicket.label.name}
                                      size="small"
                                      variant="outlined"
                                      sx={{
                                        borderColor: estimate.followUpTicket.label.color || '#8B5CF6',
                                        color: estimate.followUpTicket.label.color || '#8B5CF6',
                                        fontSize: '0.7rem',
                                        height: 22,
                                        width: 'fit-content',
                                        fontWeight: 500
                                      }}
                                    />
                                  )}
                                  {estimate.followUpTicket.follow_up_date && (
                                    <Typography 
                                      variant="caption" 
                                      sx={{ 
                                        fontSize: '0.7rem', 
                                        color: 'text.secondary',
                                        fontWeight: 500,
                                        display: 'block',
                                        mt: 0.25
                                      }}
                                    >
                                      📅 {formatDate(estimate.followUpTicket.follow_up_date)}
                                    </Typography>
                                  )}
                                </>
                              )}
                            </Box>
                          ) : (
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                fontSize: '0.7rem', 
                                color: 'text.disabled', 
                                fontStyle: 'italic'
                              }}
                            >
                              —
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ textAlign: 'center' }}>
                          <Tooltip title="Follow-Up Ticket">
                            <IconButton
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEstimateForTicket(estimate);
                                setFollowUpTicketOpen(true);
                              }}
                              size="small"
                              color="primary"
                            >
                              <AssignmentIcon />
                            </IconButton>
                          </Tooltip>
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
                        <TableCell colSpan={11} align="center" sx={{ py: 4 }}>
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

      {/* Mailchimp Export Modal */}
      <MailchimpExportModal
        open={mailchimpExportOpen}
        onClose={() => setMailchimpExportOpen(false)}
      />

      {/* Follow-Up Ticket Modal */}
      {selectedEstimateForTicket && (
        <FollowUpTicketModal
          open={followUpTicketOpen}
          onClose={() => {
            setFollowUpTicketOpen(false);
            setSelectedEstimateForTicket(null);
          }}
          estimateId={selectedEstimateForTicket.id}
          estimateName={selectedEstimateForTicket.name}
        />
      )}
    </Box>
  );
};

export default FollowUpEstimates;

