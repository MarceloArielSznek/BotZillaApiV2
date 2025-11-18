import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Paper,
  TableContainer,
  Chip,
  Divider
} from '@mui/material';
import estimateService, { type Estimate } from '../../services/estimateService';
import JobDetailsModal from '../jobs/JobDetailsModal';

interface EstimateDetailsModalProps {
  estimateId: number | null;
  open: boolean;
  onClose: () => void;
}

const EstimateDetailsModal: React.FC<EstimateDetailsModalProps> = ({ estimateId, open, onClose }) => {
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [jobOpen, setJobOpen] = useState<boolean>(false);

  useEffect(() => {
    const load = async () => {
      if (!estimateId || !open) return;
      setLoading(true);
      try {
        const data = await estimateService.getEstimateDetails(estimateId);
        setEstimate(data);
      } catch (e) {
        // noop (podemos mostrar snackbar en el futuro)
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [estimateId, open]);

  const formatCurrency = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return 'N/A';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return 'N/A';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
  };

  const InfoRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <TableRow>
      <TableCell sx={{ width: 220, fontWeight: 'bold' }}>{label}</TableCell>
      <TableCell>{value as any}</TableCell>
    </TableRow>
  );

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Estimate Details</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : estimate ? (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 2 }}>
              <Box>
                <Typography variant="h6">{estimate.name}</Typography>
                <Typography variant="body2" color="textSecondary">
                  {estimate.Branch?.name || 'N/A'} Branch
                </Typography>
              </Box>
              <Box sx={{ textAlign: { sm: 'right' } }}>
                <Typography variant="subtitle1">
                  <strong>Estimator:</strong> {estimate.SalesPerson?.name || 'N/A'}
                </Typography>
                <Chip
                  size="small"
                  label={estimate.EstimateStatus?.name || 'N/A'}
                  sx={{ mt: 1 }}
                />
              </Box>
            </Box>

            <Divider sx={{ mb: 2 }} />

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableBody>
                  <InfoRow label="Customer" value={estimate.customer_name || 'N/A'} />
                  <InfoRow label="Address" value={estimate.customer_address || 'N/A'} />
                  <InfoRow label="Email" value={estimate.customer_email || 'N/A'} />
                  <InfoRow label="Phone" value={estimate.customer_phone || 'N/A'} />
                  <InfoRow label="Final Price" value={formatCurrency(estimate.final_price)} />
                  <InfoRow label="Retail Cost" value={formatCurrency(estimate.retail_cost)} />
                  <InfoRow label="Discount" value={estimate.discount != null ? `${parseFloat(String(estimate.discount)).toFixed(2)}%` : 'N/A'} />
                  <InfoRow label="AT Hours" value={estimate.attic_tech_hours != null ? `${Number(estimate.attic_tech_hours).toFixed(2)}h` : 'N/A'} />
                  <InfoRow label="AT Created" value={estimate.at_created_date ? new Date(estimate.at_created_date).toLocaleDateString() : 'N/A'} />
                  <InfoRow label="AT Updated" value={estimate.at_updated_date ? new Date(estimate.at_updated_date).toLocaleDateString() : 'N/A'} />
                </TableBody>
              </Table>
            </TableContainer>

            {/* Pricing Breakdown Section */}
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>
                Pricing Breakdown
              </Typography>
              
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableBody>
                    {/* True Cost Breakdown */}
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
                              <InfoRow 
                                label="True Cost (Non-Sub)" 
                                value={<Typography sx={{ color: 'success.main', fontWeight: 600 }}>{formatCurrency(trueCostNonSub)}</Typography>} 
                              />
                              <InfoRow 
                                label="Sub Material Base" 
                                value={<Typography sx={{ color: 'info.main', fontWeight: 600 }}>{formatCurrency(subMaterialBase)}</Typography>} 
                              />
                              <InfoRow 
                                label="True Cost Total" 
                                value={<Typography sx={{ fontWeight: 600 }}>{formatCurrency(trueCost)}</Typography>} 
                              />
                            </>
                          ) : (
                            <InfoRow 
                              label="True Cost" 
                              value={<Typography sx={{ fontWeight: 600 }}>{formatCurrency(trueCost)}</Typography>} 
                            />
                          )}
                        </>
                      );
                    })()}
                    
                    {/* Multipliers */}
                    {estimate.calculated_multiplier != null && (
                      <InfoRow 
                        label="Multiplier (Theoretical)" 
                        value={<Chip label={`${estimate.calculated_multiplier}x`} size="small" color="success" />} 
                      />
                    )}
                    
                    {/* Effective Multiplier */}
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
                      
                      // Calculate effective multiplier
                      if (trueCostNonSub > 0 && finalPrice > 0 && retailCost > 0) {
                        // 1. Remove payment method factor from both
                        const finalBeforePM = finalPrice / paymentMethodFactor;
                        const retailBeforePM = retailCost / paymentMethodFactor;
                        
                        // 2. Calculate Non-Sub portion (discount distributed proportionally)
                        const nonSubRetailOriginal = retailBeforePM - subRetailCost;
                        const nonSubPercentage = nonSubRetailOriginal / retailBeforePM;
                        const nonSubRetailEffective = finalBeforePM * nonSubPercentage;
                        
                        // 3. Calculate effective multiplier
                        const effectiveMultiplier = nonSubRetailEffective / trueCostNonSub;
                        
                        return (
                          <InfoRow 
                            label="Multiplier (Effective)" 
                            value={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Chip label={`${effectiveMultiplier.toFixed(2)}x`} size="small" color="warning" />
                                <Typography variant="caption" color="textSecondary">
                                  (after discount)
                                </Typography>
                              </Box>
                            } 
                          />
                        );
                      }
                      return null;
                    })()}
                    
                    {estimate.sub_multiplier != null && estimate.sub_service_retail_cost != null && estimate.sub_service_retail_cost > 0 && (
                      <InfoRow 
                        label="Sub Multiplier" 
                        value={<Chip label={`${estimate.sub_multiplier}x`} size="small" color="info" />} 
                      />
                    )}
                    {estimate.payment_method_factor != null && (
                      <InfoRow 
                        label="Payment Method Factor" 
                        value={<Chip label={`${estimate.payment_method_factor}x`} size="small" color="primary" />} 
                      />
                    )}
                    
                    {/* Payment Method */}
                    {estimate.PaymentMethod && (
                      <InfoRow 
                        label="Payment Method" 
                        value={<Chip label={estimate.PaymentMethod.name} size="small" variant="outlined" sx={{ textTransform: 'capitalize' }} />} 
                      />
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {/* Snapshot Multiplier Ranges */}
            {estimate.snapshot_multiplier_ranges && Array.isArray(estimate.snapshot_multiplier_ranges) && estimate.snapshot_multiplier_ranges.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>
                  Multiplier Ranges Snapshot
                </Typography>
                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 1 }}>
                  Historical multiplier ranges when this estimate was created
                </Typography>
                
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableBody>
                      {estimate.snapshot_multiplier_ranges
                        .sort((a: any, b: any) => a.minCost - b.minCost)
                        .map((range: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell sx={{ fontWeight: 'bold', width: 200 }}>
                              {range.name}
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2">
                                  {formatCurrency(range.minCost)} - {range.maxCost ? formatCurrency(range.maxCost) : '∞'}
                                </Typography>
                                <Chip 
                                  label={`${range.lowestMultiple}x`} 
                                  size="small" 
                                  color={estimate.calculated_multiplier === range.lowestMultiple ? 'success' : 'default'}
                                  sx={{ ml: 1 }}
                                />
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {estimate.crew_notes && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Crew Notes</Typography>
                <Typography variant="body2" color="textSecondary">{estimate.crew_notes}</Typography>
              </Box>
            )}
          </>
        ) : (
          <Typography variant="body2" color="textSecondary">No data available.</Typography>
        )}
      </DialogContent>
      <DialogActions>
        {estimate?.job?.id && (
          <Button
            variant="contained"
            color="primary"
            onClick={() => setJobOpen(true)}
          >
            Jump to Job
          </Button>
        )}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>

      {/* Job details modal nested */}
      <JobDetailsModal
        jobId={estimate?.job?.id || null}
        open={jobOpen}
        onClose={() => setJobOpen(false)}
      />
    </Dialog>
  );
};

export default EstimateDetailsModal;

