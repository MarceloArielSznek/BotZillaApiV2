import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Box,
  Chip,
  OutlinedInput,
  CircularProgress,
  Alert,
  Typography,
  SelectChangeEvent
} from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';
import estimateService, { type Branch } from '../../services/estimateService';
import { api } from '../../config/api';

interface MailchimpExportModalProps {
  open: boolean;
  onClose: () => void;
}

interface EstimateStatus {
  id: number;
  name: string;
}

const MailchimpExportModal: React.FC<MailchimpExportModalProps> = ({ open, onClose }) => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<number[]>([]);
  const [statuses, setStatuses] = useState<EstimateStatus[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<number[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar branches y statuses al abrir el modal
  useEffect(() => {
    if (open) {
      loadBranches();
      loadStatuses();
      // Pre-seleccionar "Lost" por defecto
      const lostStatus = statuses.find(s => s.name === 'Lost');
      if (lostStatus) {
        setSelectedStatuses([lostStatus.id]);
      }
    }
  }, [open]);

  const loadBranches = async () => {
    try {
      setLoading(true);
      setError(null);
      const branchesData = await estimateService.getBranches();
      setBranches(Array.isArray(branchesData) ? branchesData : []);
    } catch (err) {
      console.error('Error loading branches:', err);
      setError('Failed to load branches');
    } finally {
      setLoading(false);
    }
  };

  const loadStatuses = async () => {
    try {
      const response = await api.get('/estimate-statuses?limit=100');
      const statusesData = response.data?.statuses || [];
      setStatuses(statusesData);
      
      // Pre-seleccionar "Lost" por defecto
      const lostStatus = statusesData.find((s: EstimateStatus) => s.name === 'Lost');
      if (lostStatus) {
        setSelectedStatuses([lostStatus.id]);
      }
    } catch (err) {
      console.error('Error loading statuses:', err);
    }
  };

  const handleBranchChange = (event: SelectChangeEvent<number[]>) => {
    const value = event.target.value;
    setSelectedBranches(typeof value === 'string' ? [] : value);
  };

  const handleStatusChange = (event: SelectChangeEvent<number[]>) => {
    const value = event.target.value;
    setSelectedStatuses(typeof value === 'string' ? [] : value);
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      setError(null);

      // Validación básica
      if (selectedBranches.length === 0) {
        setError('Please select at least one branch');
        setExporting(false);
        return;
      }

      if (selectedStatuses.length === 0) {
        setError('Please select at least one status');
        setExporting(false);
        return;
      }

      if (!startDate || !endDate) {
        setError('Please select both start and end dates');
        setExporting(false);
        return;
      }

      // Construir query params
      const params = new URLSearchParams({
        branchIds: selectedBranches.join(','),
        statusIds: selectedStatuses.join(','),
        startDate: startDate,
        endDate: endDate
      });

      // Hacer la petición
      const response = await api.get(`/estimates/export/mailchimp?${params.toString()}`, {
        responseType: 'blob'
      });

      // Crear URL para descargar el archivo
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generar nombre del archivo
      const dateStr = new Date().toISOString().split('T')[0];
      const branchesStr = `branches-${selectedBranches.join('-')}`;
      link.setAttribute('download', `mailchimp_contacts_${branchesStr}_${dateStr}.xlsx`);
      
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      // Cerrar el modal después de la descarga
      onClose();
      
      // Resetear formulario
      setSelectedBranches([]);
      setSelectedStatuses([]);
      setStartDate('');
      setEndDate('');

    } catch (err: any) {
      console.error('Error exporting:', err);
      setError(err.response?.data?.message || 'Failed to export. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleClose = () => {
    if (!exporting) {
      setSelectedBranches([]);
      setSelectedStatuses([]);
      setStartDate('');
      setEndDate('');
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DownloadIcon />
          <Typography variant="h6">Export for Mailchimp</Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <FormControl fullWidth>
              <InputLabel id="branches-label">Branches *</InputLabel>
              <Select
                labelId="branches-label"
                multiple
                value={selectedBranches}
                onChange={handleBranchChange}
                input={<OutlinedInput label="Branches *" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((branchId) => {
                      const branch = branches.find(b => b.id === branchId);
                      return (
                        <Chip 
                          key={branchId} 
                          label={branch?.name || branchId} 
                          size="small" 
                        />
                      );
                    })}
                  </Box>
                )}
              >
                {branches.map((branch) => (
                  <MenuItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="statuses-label">Estimate Status *</InputLabel>
              <Select
                labelId="statuses-label"
                multiple
                value={selectedStatuses}
                onChange={handleStatusChange}
                input={<OutlinedInput label="Estimate Status *" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((statusId) => {
                      const status = statuses.find(s => s.id === statusId);
                      return (
                        <Chip 
                          key={statusId} 
                          label={status?.name || statusId} 
                          size="small"
                          color={status?.name === 'Lost' ? 'error' : status?.name === 'Won' ? 'success' : 'default'}
                        />
                      );
                    })}
                  </Box>
                )}
              >
                {statuses.map((status) => (
                  <MenuItem key={status.id} value={status.id}>
                    {status.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="From Date *"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />

            <TextField
              label="To Date *"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />

            <Alert severity="info" sx={{ mt: 1 }}>
              <strong>📊 Export Summary:</strong>
              <br /><br />
              • Select the <strong>estimate statuses</strong> you want to export (e.g., Lost, Won, Pending)
              <br />
              • Choose the <strong>branches</strong> and <strong>date range</strong>
              <br />
              • Excel will include: First Name, Last Name, Address, Phone, Email, Branch, Status, Updated At
              <br /><br />
              <strong>💡 Tip:</strong> Select only "Lost" for follow-up campaigns, or multiple statuses for broader analysis.
            </Alert>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={exporting}>
          Cancel
        </Button>
        <Button
          onClick={handleExport}
          variant="contained"
          disabled={exporting || loading || selectedBranches.length === 0 || selectedStatuses.length === 0 || !startDate || !endDate}
          startIcon={exporting ? <CircularProgress size={20} /> : <DownloadIcon />}
        >
          {exporting ? 'Exporting...' : 'Export Excel'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MailchimpExportModal;

