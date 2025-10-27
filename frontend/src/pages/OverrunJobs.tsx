import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  CircularProgress,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { Warning as WarningIcon, Refresh as RefreshIcon, Send as SendIcon, Description as DescriptionIcon } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { getOverrunJobs, sendOverrunAlert } from '../services/jobService';
import branchService from '../services/branchService';
import { useDebounce } from '../hooks/useDebounce';
import type { Job } from '../interfaces';

interface Branch {
  id: number;
  name: string;
}

const OverrunJobs: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  
  // State
  const [jobs, setJobs] = useState<Job[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalJobs, setTotalJobs] = useState(0);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Modal state
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<{ jobName: string; report: string; createdAt: string } | null>(null);
  
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Load branches
  useEffect(() => {
    const loadBranches = async () => {
      try {
        const response = await branchService.getBranches({ limit: 100 });
        setBranches(response.branches || []);
      } catch (error: any) {
        console.error('Error loading branches:', error);
        enqueueSnackbar('Error loading branches', { variant: 'error' });
      }
    };
    loadBranches();
  }, []);

  // Load overrun jobs
  useEffect(() => {
    loadOverrunJobs();
  }, [page, rowsPerPage, debouncedSearchTerm, selectedBranch, startDate, endDate]);

  const loadOverrunJobs = async () => {
    setLoading(true);
    try {
      const filters: any = {
        page: page + 1,
        limit: rowsPerPage
      };
      
      if (debouncedSearchTerm) filters.search = debouncedSearchTerm;
      if (selectedBranch) filters.branchId = selectedBranch;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      const response = await getOverrunJobs(filters);
      
      // Verificar que response y response.data existan
      if (response && response.data !== undefined && response.data !== null) {
        setJobs(response.data);
        setTotalJobs(response.pagination?.total || 0);
      } else {
        // Si no hay data válida, simplemente limpiamos el estado sin mostrar error
        // porque puede ser una llamada inicial o de cleanup
        console.warn('No valid data in response:', response);
        setJobs([]);
        setTotalJobs(0);
      }
    } catch (error: any) {
      console.error('Error loading overrun jobs:', error);
      setJobs([]);
      setTotalJobs(0);
      enqueueSnackbar(error?.response?.data?.message || 'Error loading overrun jobs', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedBranch('');
    setStartDate('');
    setEndDate('');
    setPage(0);
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return 'N/A';
    return `$${value.toFixed(2)}`;
  };

  const formatPercentage = (value: number | null | undefined) => {
    if (value === null || value === undefined) return 'N/A';
    return `${value.toFixed(2)}%`;
  };

  const handleSendAlert = async (jobId: number, jobName: string) => {
    try {
      await sendOverrunAlert(jobId);
      enqueueSnackbar(`Overrun alert sent for "${jobName}"`, { variant: 'success' });
      // Recargar jobs para actualizar el estado del botón
      loadOverrunJobs();
    } catch (error: any) {
      console.error('Error sending overrun alert:', error);
      enqueueSnackbar(error?.response?.data?.message || 'Failed to send overrun alert', { variant: 'error' });
    }
  };

  const handleOpenReport = (job: any) => {
    setSelectedReport({
      jobName: job.name,
      report: job.overrun_report?.report || 'No report available',
      createdAt: job.overrun_report?.created_at || ''
    });
    setReportModalOpen(true);
  };

  const handleCloseReport = () => {
    setReportModalOpen(false);
    setSelectedReport(null);
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Jobs where total worked hours exceeded AT estimated hours
      </Typography>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Filters</Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mb: 2 }}>
          <TextField
            label="Search by Job Name"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ minWidth: 250 }}
          />
          
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Branch</InputLabel>
            <Select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              label="Branch"
            >
              <MenuItem value="">All Branches</MenuItem>
              {branches.map((branch) => (
                <MenuItem key={branch.id} value={branch.id.toString()}>
                  {branch.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="From Date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            label="To Date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
          />

          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleClearFilters}
          >
            Clear
          </Button>
        </Stack>
      </Paper>

      {/* Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Job Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Branch</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Crew Leader</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Estimator</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Closing Date</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">AT Est. Hours</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">Worked Hours</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">Saved Hours</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">% Actual Saved</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">Job Bonus Pool</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="center">Report</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="center">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={12} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : jobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} align="center">
                    <Typography variant="body2" color="text.secondary">
                      No overrun jobs found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                jobs.map((job: any) => (
                  <TableRow key={job.id} hover>
                    <TableCell>{job.name}</TableCell>
                    <TableCell>{job.branch?.name || 'N/A'}</TableCell>
                    <TableCell>{job.crew_leader?.name || 'N/A'}</TableCell>
                    <TableCell>{job.estimator || 'N/A'}</TableCell>
                    <TableCell>
                      {job.closing_date ? new Date(job.closing_date).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell align="right">{job.at_estimated_hours?.toFixed(2) || 'N/A'}</TableCell>
                    <TableCell align="right">{job.total_worked_hours?.toFixed(2) || 'N/A'}</TableCell>
                    <TableCell align="right">
                      <Chip
                        label={job.total_saved_hours?.toFixed(2) || 'N/A'}
                        size="small"
                        color="error"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        label={formatPercentage(job.actual_percent_saved)}
                        size="small"
                        color="error"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        label={formatCurrency(job.job_bonus_pool)}
                        size="small"
                        color={job.job_bonus_pool && job.job_bonus_pool < 0 ? 'error' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="center">
                      {job.overrun_report ? (
                        <Tooltip title="View Report">
                          <IconButton
                            color="success"
                            size="small"
                            onClick={() => handleOpenReport(job)}
                          >
                            <DescriptionIcon />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No Report
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title={job.overrun_report ? "Report already generated" : "Send Overrun Alert"}>
                        <span>
                          <IconButton
                            color="error"
                            size="small"
                            onClick={() => handleSendAlert(job.id, job.name)}
                            disabled={!!job.overrun_report}
                          >
                            <SendIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={totalJobs}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* Report Modal */}
      <Dialog
        open={reportModalOpen}
        onClose={handleCloseReport}
        maxWidth="md"
        fullWidth
        fullScreen={false}
        sx={{
          '& .MuiDialog-paper': {
            margin: { xs: 1, sm: 2 },
            maxHeight: { xs: '90vh', sm: '80vh' }
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" component="div" sx={{ 
            fontWeight: 'bold',
            fontSize: { xs: '1rem', sm: '1.25rem' }
          }}>
            Overrun Report
          </Typography>
          <Typography variant="subtitle2" color="text.secondary" sx={{ 
            mt: 0.5,
            fontSize: { xs: '0.875rem', sm: '1rem' }
          }}>
            {selectedReport?.jobName}
          </Typography>
        </DialogTitle>
        <DialogContent dividers sx={{ px: { xs: 2, sm: 3 } }}>
          <Typography 
            variant="caption" 
            color="text.secondary" 
            sx={{ 
              mb: 2, 
              display: 'block',
              fontSize: { xs: '0.75rem', sm: '0.875rem' }
            }}
          >
            Generated: {selectedReport?.createdAt ? new Date(selectedReport.createdAt).toLocaleString() : 'N/A'}
          </Typography>
          <Typography
            variant="body1"
            component="pre"
            sx={{
              whiteSpace: 'pre-wrap',
              fontFamily: 'inherit',
              lineHeight: 1.6,
              fontSize: { xs: '0.875rem', sm: '1rem' },
              wordBreak: 'break-word',
              overflowWrap: 'break-word'
            }}
          >
            {selectedReport?.report}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: { xs: 1.5, sm: 2 } }}>
          <Button 
            onClick={handleCloseReport} 
            color="primary"
            variant="contained"
            fullWidth={false}
            sx={{ minWidth: { xs: 100, sm: 120 } }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OverrunJobs;

