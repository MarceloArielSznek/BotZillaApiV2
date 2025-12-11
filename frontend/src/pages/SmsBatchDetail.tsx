import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Grid,
  Divider,
  TablePagination,
  TextField,
  InputAdornment,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FilterList as FilterListIcon,
  LocationOn as LocationOnIcon,
  Person as PersonIcon,
  AttachMoney as AttachMoneyIcon,
  CalendarToday as CalendarTodayIcon,
  Label as LabelIcon,
  Visibility as VisibilityIcon,
  Assignment as AssignmentIcon,
  ExpandMore as ExpandMoreIcon,
  Send as SendIcon,
  Message as MessageIcon,
  Insights as InsightsIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import smsBatchService, { type SmsBatch } from '../services/smsBatchService';
import estimateService from '../services/estimateService';
import followUpTicketService from '../services/followUpTicketService';
import EstimateDetailsModal from '../components/estimates/EstimateDetailsModal';
import FollowUpTicketModal from '../components/followUp/FollowUpTicketModal';

const SmsBatchDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [batch, setBatch] = useState<SmsBatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [salespeople, setSalespeople] = useState<any[]>([]);
  const [followUpStatuses, setFollowUpStatuses] = useState<any[]>([]);
  const [followUpLabels, setFollowUpLabels] = useState<any[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedEstimateId, setSelectedEstimateId] = useState<number | null>(null);
  const [followUpTicketOpen, setFollowUpTicketOpen] = useState(false);
  const [selectedEstimateForTicket, setSelectedEstimateForTicket] = useState<any | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [smsMessage, setSmsMessage] = useState('');
  const [smsPreview, setSmsPreview] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      fetchBatch();
      loadFilterData();
    }
  }, [id]);

  const loadFilterData = async () => {
    try {
      const [branchesData, salespeopleData, statusesData, labelsData] = await Promise.all([
        estimateService.getBranches().catch(() => []),
        estimateService.getSalesPersons({}).catch(() => []),
        followUpTicketService.getAllStatuses().catch(() => []),
        followUpTicketService.getAllLabels().catch(() => []),
      ]);

      setBranches(Array.isArray(branchesData) ? branchesData : []);
      setSalespeople(Array.isArray(salespeopleData) ? salespeopleData : []);
      setFollowUpStatuses(Array.isArray(statusesData) ? statusesData : []);
      setFollowUpLabels(Array.isArray(labelsData) ? labelsData : []);
    } catch (err) {
      console.error('Error loading filter data:', err);
    }
  };

  const fetchBatch = async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);
      const batchData = await smsBatchService.getBatchById(parseInt(id));
      if (batchData) {
        setBatch(batchData);
      } else {
        setError('Batch not found');
      }
    } catch (err: any) {
      console.error('Error fetching batch:', err);
      // Solo mostrar error si no fue cancelado
      if (!err.message?.includes('canceled') && !err.message?.includes('canceled')) {
        setError(err.response?.data?.message || err.message || 'Failed to load batch');
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'default';
      case 'ready': return 'info';
      case 'sent': return 'success';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MM/dd/yyyy HH:mm');
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
    if (hours === null || hours === undefined) return 'N/A';
    const numHours = typeof hours === 'string' ? parseFloat(hours) : hours;
    return `${numHours.toFixed(2)}h`;
  };

  const handleViewDetails = (estimateId: number) => {
    setSelectedEstimateId(estimateId);
    setDetailsOpen(true);
  };

  const handleRemoveEstimate = async (estimateId: number, estimateName: string) => {
    if (!id || !window.confirm(`¿Estás seguro de que quieres remover "${estimateName}" del batch?`)) {
      return;
    }

    try {
      await smsBatchService.removeEstimateFromBatch(parseInt(id), estimateId);
      // Recargar el batch para actualizar la lista
      await fetchBatch();
    } catch (err: any) {
      console.error('Error removing estimate from batch:', err);
      setError(err.response?.data?.message || 'Failed to remove estimate from batch');
    }
  };

  const getBranchName = (branchId: number) => {
    const branch = branches.find(b => b.id === branchId);
    return branch?.name || `Branch #${branchId}`;
  };

  const getSalespersonName = (salespersonId: number) => {
    const person = salespeople.find(s => s.id === salespersonId);
    return person?.name || `Salesperson #${salespersonId}`;
  };

  const getFollowUpStatusName = (statusId: number) => {
    const status = followUpStatuses.find(s => s.id === statusId);
    return status?.name || `Status #${statusId}`;
  };

  const getFollowUpLabelName = (labelId: number) => {
    const label = followUpLabels.find(l => l.id === labelId);
    return label?.name || `Label #${labelId}`;
  };

  const renderFilters = () => {
    if (!batch.metadata || Object.keys(batch.metadata).length === 0) {
      return null;
    }

    const filters = batch.metadata;
    const filterItems: React.ReactElement[] = [];

    // Price Range
    if (filters.priceMin || filters.priceMax) {
      filterItems.push(
        <Chip
          key="price"
          icon={<AttachMoneyIcon />}
          label={
            filters.priceMin && filters.priceMax
              ? `${formatCurrency(filters.priceMin)} - ${formatCurrency(filters.priceMax)}`
              : filters.priceMin
              ? `Min: ${formatCurrency(filters.priceMin)}`
              : `Max: ${formatCurrency(filters.priceMax)}`
          }
          color="primary"
          variant="outlined"
          sx={{ m: 0.5 }}
        />
      );
    }

    // Date Range
    if (filters.startDate || filters.endDate) {
      const startDate = filters.startDate ? format(new Date(filters.startDate), 'MMM dd, yyyy') : '';
      const endDate = filters.endDate ? format(new Date(filters.endDate), 'MMM dd, yyyy') : '';
      filterItems.push(
        <Chip
          key="date"
          icon={<CalendarTodayIcon />}
          label={
            startDate && endDate
              ? `${startDate} - ${endDate}`
              : startDate
              ? `From: ${startDate}`
              : `Until: ${endDate}`
          }
          color="primary"
          variant="outlined"
          sx={{ m: 0.5 }}
        />
      );
    }

    // Branch
    if (filters.branch) {
      filterItems.push(
        <Chip
          key="branch"
          icon={<LocationOnIcon />}
          label={getBranchName(filters.branch)}
          color="primary"
          variant="outlined"
          sx={{ m: 0.5 }}
        />
      );
    }

    // Salesperson
    if (filters.salesperson) {
      filterItems.push(
        <Chip
          key="salesperson"
          icon={<PersonIcon />}
          label={getSalespersonName(filters.salesperson)}
          color="primary"
          variant="outlined"
          sx={{ m: 0.5 }}
        />
      );
    }

    // Follow-Up Status
    if (filters.followUpStatus) {
      filterItems.push(
        <Chip
          key="followUpStatus"
          icon={<FilterListIcon />}
          label={`Status: ${getFollowUpStatusName(filters.followUpStatus)}`}
          color="primary"
          variant="outlined"
          sx={{ m: 0.5 }}
        />
      );
    }

    // Follow-Up Label
    if (filters.followUpLabel) {
      filterItems.push(
        <Chip
          key="followUpLabel"
          icon={<LabelIcon />}
          label={`Label: ${getFollowUpLabelName(filters.followUpLabel)}`}
          color="primary"
          variant="outlined"
          sx={{ m: 0.5 }}
        />
      );
    }

    return filterItems.length > 0 ? (
      <Box sx={{ mt: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <FilterListIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
            Filters Applied
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            p: 2,
            bgcolor: 'background.default',
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          {filterItems}
        </Box>
      </Box>
    ) : null;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !batch) {
    return (
      <Box>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/follow-up/sms-batches')}
          sx={{ mb: 2 }}
        >
          Back to Batches
        </Button>
        <Alert severity="error">
          {error || 'Batch not found'}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/follow-up/sms-batches')}
          >
            Back
          </Button>
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
            {batch.name}
          </Typography>
          <Chip
            label={batch.status}
            size="small"
            color={getStatusColor(batch.status) as any}
            sx={{ textTransform: 'capitalize' }}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => navigate(`/follow-up/sms-batches/${batch.id}/edit`)}
          >
            Edit
          </Button>
        </Box>
      </Box>

      {/* Batch Info */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Batch Information
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Description
              </Typography>
              <Typography variant="body1">
                {batch.description || 'No description'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 4 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Total Estimates
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                  {batch.total_estimates}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Created By
                </Typography>
                <Typography variant="body1">
                  {batch.creator?.email || 'N/A'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Created At
                </Typography>
                <Typography variant="body1">
                  {formatDate(batch.created_at)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Updated At
                </Typography>
                <Typography variant="body1">
                  {formatDate(batch.updated_at)}
                </Typography>
              </Box>
            </Box>
            {renderFilters()}
          </Box>
        </CardContent>
      </Card>

      <Divider sx={{ my: 4 }} />

      {/* Estimates List */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ p: 2, pb: 1 }}>
            <Typography variant="h6">
              Estimates ({batch.estimates?.length || 0})
            </Typography>
          </Box>
          {batch.estimates && batch.estimates.length > 0 ? (
            <>
              <TableContainer component={Paper}>
                <Table sx={{ minWidth: 650 }} aria-label="estimates table">
                <TableHead>
                  <TableRow>
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
                  {batch.estimates
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((estimate: any) => (
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
                      
                      {/* Costs Column */}
                      <TableCell>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 160 }}>
                          {(() => {
                            const trueCost = estimate.price != null ? Number(estimate.price) : 0;
                            const subRetailCost = estimate.sub_service_retail_cost != null ? Number(estimate.sub_service_retail_cost) : 0;
                            const subFactor = estimate.sub_multiplier || 1.75;
                            const hasSubServices = subRetailCost > 0;
                            
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
                          
                          {(() => {
                            const trueCost = estimate.price != null ? Number(estimate.price) : 0;
                            const finalPrice = estimate.final_price != null ? Number(estimate.final_price) : 0;
                            const retailCost = estimate.retail_cost != null ? Number(estimate.retail_cost) : 0;
                            const subRetailCost = estimate.sub_service_retail_cost != null ? Number(estimate.sub_service_retail_cost) : 0;
                            const paymentMethodFactor = estimate.payment_method_factor || 1.065;
                            const subFactor = estimate.sub_multiplier || 1.75;
                            const hasSubServices = subRetailCost > 0;
                            
                            const subMaterialBase = hasSubServices ? subRetailCost / subFactor : 0;
                            const trueCostNonSub = hasSubServices ? trueCost - subMaterialBase : trueCost;
                            
                            if (trueCostNonSub > 0 && finalPrice > 0 && retailCost > 0) {
                              const finalBeforePM = finalPrice / paymentMethodFactor;
                              const retailBeforePM = retailCost / paymentMethodFactor;
                              const nonSubRetailOriginal = retailBeforePM - subRetailCost;
                              const nonSubPercentage = nonSubRetailOriginal / retailBeforePM;
                              const nonSubRetailEffective = finalBeforePM * nonSubPercentage;
                              const effectiveMultiplier = nonSubRetailEffective / trueCostNonSub;
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
                        {estimate.attic_tech_hours != null ? formatHours(estimate.attic_tech_hours) : 'N/A'}
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
                          <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', fontStyle: 'italic' }}>
                            —
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
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
                        <Tooltip title="Remove from batch">
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveEstimate(estimate.id, estimate.name || `Estimate #${estimate.id}`);
                            }}
                            size="small"
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25, 50]}
              component="div"
              count={batch.estimates.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              labelRowsPerPage="Rows per page:"
            />
            </>
          ) : (
            <Box sx={{ p: 3 }}>
              <Alert severity="info">No estimates in this batch</Alert>
            </Box>
          )}
        </CardContent>
      </Card>

      <Divider sx={{ my: 4 }} />

      {/* SMS Builder Section */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <MessageIcon color="primary" />
            <Typography variant="h6">
              SMS Message Builder
            </Typography>
          </Box>

          {/* Batch Insights */}
          <Accordion defaultExpanded sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <InsightsIcon color="primary" />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Batch Insights
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Total Estimates
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {batch.total_estimates}
                    </Typography>
                  </Box>
                  {batch.estimates && batch.estimates.length > 0 && (() => {
                    const totalValue = batch.estimates.reduce((sum: number, est: any) => {
                      const price = est.final_price ? Number(est.final_price) : 0;
                      return sum + price;
                    }, 0);
                    const avgValue = totalValue / batch.estimates.length;
                    const branches = new Set(batch.estimates.map((e: any) => e.Branch?.name).filter(Boolean));
                    const salespeople = new Set(batch.estimates.map((e: any) => e.SalesPerson?.name).filter(Boolean));
                    
                    return (
                      <>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Total Value
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                            {formatCurrency(totalValue)}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Average Value
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                            {formatCurrency(avgValue)}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Branches
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                            {branches.size}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Salespeople
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                            {salespeople.size}
                          </Typography>
                        </Box>
                      </>
                    );
                  })()}
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* SMS Message Builder */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Available Variables
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                {[
                  { var: '{{first_name}}', label: 'First Name' },
                  { var: '{{last_name}}', label: 'Last Name' },
                  { var: '{{customer_name}}', label: 'Full Name' },
                  { var: '{{estimate_name}}', label: 'Estimate Name' },
                  { var: '{{final_price}}', label: 'Final Price' },
                  { var: '{{branch_name}}', label: 'Branch Name' },
                  { var: '{{salesperson_name}}', label: 'Salesperson Name' },
                  { var: '{{discount}}', label: 'Discount %' },
                ].map((item) => (
                  <Chip
                    key={item.var}
                    label={`${item.var} - ${item.label}`}
                    size="small"
                    onClick={() => {
                      setSmsMessage(prev => prev + item.var);
                    }}
                    sx={{ cursor: 'pointer' }}
                    variant="outlined"
                  />
                ))}
              </Box>
            </Box>
            
            <TextField
              label="SMS Message"
              multiline
              rows={4}
              fullWidth
              value={smsMessage}
              onChange={(e) => setSmsMessage(e.target.value)}
              placeholder="Hello {{customer_name}}, we have a special offer for you..."
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Typography variant="caption" color="text.secondary">
                      {smsMessage.length} / 160
                    </Typography>
                  </InputAdornment>
                ),
              }}
            />

            {smsMessage && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  Preview (First 3 estimates)
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {batch.estimates?.slice(0, 3).map((estimate: any, idx: number) => {
                    // Obtener el nombre del cliente: PRIORIDAD al campo customer_name
                    const estimateName = estimate.name || '';
                    
                    // IMPORTANTE: Usar customer_name del estimate, NO el name
                    // Si customer_name no existe o está vacío, solo entonces usar estimate name como fallback
                    let customerName = estimate.customer_name;
                    
                    // Debug: verificar qué está llegando
                    if (idx === 0) {
                      console.log('Estimate data:', {
                        name: estimate.name,
                        customer_name: estimate.customer_name,
                        hasCustomerName: !!estimate.customer_name
                      });
                    }
                    
                    if (!customerName || customerName.trim() === '') {
                      // Fallback: extraer del estimate name (formato: "Name - Branch" o solo "Name")
                      customerName = estimateName.split(' - ')[0] || estimateName;
                    }
                    
                    // Dividir en first_name y last_name basado en el primer espacio
                    // first_name = primera cadena de caracteres (antes del primer espacio)
                    // last_name = todo lo que viene después del primer espacio
                    const trimmedName = customerName.trim();
                    const firstSpaceIndex = trimmedName.indexOf(' ');
                    const firstName = firstSpaceIndex > 0 
                      ? trimmedName.substring(0, firstSpaceIndex) 
                      : trimmedName || 'Customer';
                    const lastName = firstSpaceIndex > 0 
                      ? trimmedName.substring(firstSpaceIndex + 1).trim() 
                      : '';
                    const fullName = customerName || 'Customer';
                    
                    let preview = smsMessage;
                    preview = preview.replace(/\{\{first_name\}\}/g, firstName);
                    preview = preview.replace(/\{\{last_name\}\}/g, lastName);
                    preview = preview.replace(/\{\{customer_name\}\}/g, fullName);
                    preview = preview.replace(/\{\{estimate_name\}\}/g, estimateName);
                    preview = preview.replace(/\{\{final_price\}\}/g, formatCurrency(estimate.final_price));
                    preview = preview.replace(/\{\{branch_name\}\}/g, estimate.Branch?.name || 'N/A');
                    preview = preview.replace(/\{\{salesperson_name\}\}/g, estimate.SalesPerson?.name || 'N/A');
                    preview = preview.replace(/\{\{discount\}\}/g, estimate.discount ? `${estimate.discount}%` : '0%');
                    
                    return (
                      <Paper key={idx} sx={{ p: 2, bgcolor: 'background.default' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                          To: {fullName} {estimateName !== fullName && `(${estimateName})`}
                        </Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {preview}
                        </Typography>
                      </Paper>
                    );
                  })}
                </Box>
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                onClick={() => setSmsMessage('')}
                disabled={!smsMessage}
              >
                Clear
              </Button>
              <Button
                variant="contained"
                startIcon={<SendIcon />}
                disabled={!smsMessage?.trim() || saving}
                onClick={async () => {
                  if (!smsMessage?.trim()) {
                    setError('Please enter a message');
                    return;
                  }

                  if (!confirm(`Are you sure you want to send SMS to ${batch.total_estimates} estimates?`)) {
                    return;
                  }

                  try {
                    setSaving(true);
                    setError(null);
                    const result = await smsBatchService.sendBatchToQuo(batch.id, smsMessage);
                    // Recargar el batch para ver el nuevo status
                    await fetchBatch();
                    alert(`Successfully sent ${result.total_sent} messages!`);
                  } catch (err: any) {
                    console.error('Error sending SMS batch:', err);
                    setError(err.response?.data?.message || 'Failed to send SMS batch');
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {saving ? 'Sending...' : `Send SMS to All (${batch.total_estimates} estimates)`}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Modals */}
      {selectedEstimateId && (
        <EstimateDetailsModal
          open={detailsOpen}
          onClose={() => {
            setDetailsOpen(false);
            setSelectedEstimateId(null);
          }}
          estimateId={selectedEstimateId}
        />
      )}

      {selectedEstimateForTicket && (
        <FollowUpTicketModal
          open={followUpTicketOpen}
          onClose={() => {
            setFollowUpTicketOpen(false);
            setSelectedEstimateForTicket(null);
            // Recargar el batch para mostrar cambios en el follow-up ticket
            if (id) {
              fetchBatch();
            }
          }}
          estimateId={selectedEstimateForTicket.id}
          estimateName={selectedEstimateForTicket.name || 'Unknown Estimate'}
        />
      )}
    </Box>
  );
};

export default SmsBatchDetail;

