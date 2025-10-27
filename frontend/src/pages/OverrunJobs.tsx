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
  Stack
} from '@mui/material';
import { Warning as WarningIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { getOverrunJobs } from '../services/jobService';
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
      setJobs(response.data || []);
      setTotalJobs(response.pagination?.total || 0);
    } catch (error: any) {
      console.error('Error loading overrun jobs:', error);
      enqueueSnackbar('Error loading overrun jobs', { variant: 'error' });
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
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : jobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">
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
    </Box>
  );
};

export default OverrunJobs;

