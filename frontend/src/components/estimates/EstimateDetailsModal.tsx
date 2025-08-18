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

