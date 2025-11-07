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
  DialogActions,
  Tabs,
  Tab,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import { Warning as WarningIcon, Refresh as RefreshIcon, Send as SendIcon, Description as DescriptionIcon, CheckBox as CheckBoxIcon } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { getOverrunJobs } from '../services/jobService';
import branchService from '../services/branchService';
import { useDebounce } from '../hooks/useDebounce';
import type { Job } from '../interfaces';
import JobDetailsModalSimple from '../components/jobs/JobDetailsModalSimple';
import { generateOperationPost } from '../services/systemService';

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
  
  // Tabs
  const [currentTab, setCurrentTab] = useState(0);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [showOnlyWithoutReport, setShowOnlyWithoutReport] = useState(false);
  
  // Selection state for bulk operations
  const [selectedJobs, setSelectedJobs] = useState<Set<number>>(new Set());
  const [sendingBulkReports, setSendingBulkReports] = useState(false);
  
  // Modal state
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<{ jobName: string; report: string; createdAt: string } | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  
  // Operation Command Post modal state
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<{ 
    jobId: number; 
    jobName: string;
    branchName?: string;
    post: string | null;
    atEstimatedHours?: number;
    totalWorkedHours?: number;
    actualPercentSaved?: number;
  } | null>(null);
  const [generatingPost, setGeneratingPost] = useState(false);
  const [postNotes, setPostNotes] = useState('');
  const [postCrewLeader, setPostCrewLeader] = useState('');
  const [postAnimal, setPostAnimal] = useState('');
  
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
  }, [page, rowsPerPage, debouncedSearchTerm, selectedBranch, startDate, endDate, currentTab]);

  const loadOverrunJobs = async () => {
    setLoading(true);
    try {
      const filters: any = {
        page: page + 1,
        limit: 1000 // Traer todos los closed jobs para filtrar en frontend
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
    setSelectedMonth('');
    setShowOnlyWithoutReport(false);
    setPage(0);
  };

  const handleMonthChange = (monthYear: string) => {
    setSelectedMonth(monthYear);
    
    if (monthYear) {
      // Formato esperado: "YYYY-MM" (ej: "2025-11")
      const [year, month] = monthYear.split('-');
      const yearNum = parseInt(year);
      const monthNum = parseInt(month);
      
      // Primer día del mes
      const firstDay = new Date(yearNum, monthNum - 1, 1);
      const startDateStr = firstDay.toISOString().split('T')[0];
      
      // Último día del mes
      const lastDay = new Date(yearNum, monthNum, 0);
      const endDateStr = lastDay.toISOString().split('T')[0];
      
      setStartDate(startDateStr);
      setEndDate(endDateStr);
    } else {
      // Si se limpia el mes, también limpiar las fechas
      setStartDate('');
      setEndDate('');
    }
  };

  // Generar opciones de mes/año (últimos 12 meses + próximos 2 meses)
  const getMonthYearOptions = () => {
    const options: string[] = [];
    const today = new Date();
    
    // Agregar últimos 12 meses
    for (let i = 12; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      options.push(`${year}-${month}`);
    }
    
    // Agregar próximos 2 meses
    for (let i = 1; i <= 2; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      options.push(`${year}-${month}`);
    }
    
    return options;
  };

  const formatMonthYearLabel = (monthYear: string) => {
    const [year, month] = monthYear.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const handleSelectJob = (jobId: number) => {
    setSelectedJobs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedJobs.size === filteredJobs.length) {
      // Deselect all
      setSelectedJobs(new Set());
    } else {
      // Select all filtered jobs
      setSelectedJobs(new Set(filteredJobs.map((j: any) => j.id)));
    }
  };

  const handleSendBulkReports = async () => {
    if (selectedJobs.size === 0) {
      enqueueSnackbar('Please select at least one job', { variant: 'warning' });
      return;
    }

    if (!window.confirm(`Send ${selectedJobs.size} job(s) to Make.com for report generation?`)) {
      return;
    }

    try {
      setSendingBulkReports(true);
      
      // Prepare job data for Make.com with exact structure
      const jobsToSend = filteredJobs
        .filter((j: any) => selectedJobs.has(j.id))
        .map((j: any) => ({
          job_id: j.id || 0,
          branch: j.branch?.name || '',
          job_name: j.name || '',
          sales_person: j.estimator || '', // estimator es el salesperson
          crew_leader: j.crew_leader?.name || '',
          closing_date: formatDateToMMDDYYYY(j.closing_date),
          at_estimated_hours: j.at_estimated_hours || 0,
          total_hours_worked: j.total_worked_hours || 0,
          hours_saved: j.total_saved_hours || 0
        }));

      // Send to Make.com webhook
      const response = await fetch('/api/overrun-reports/send-bulk-to-make', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ jobs: jobsToSend })
      });

      if (!response.ok) {
        throw new Error('Failed to send jobs to Make.com');
      }

      enqueueSnackbar(`Successfully sent ${selectedJobs.size} job(s) to Make.com for processing`, { variant: 'success' });
      setSelectedJobs(new Set());
      
      // Reload jobs after a delay to see updated reports
      setTimeout(() => {
        loadOverrunJobs();
      }, 2000);
      
    } catch (error: any) {
      console.error('Error sending bulk reports:', error);
      enqueueSnackbar(error?.message || 'Failed to send jobs to Make.com', { variant: 'error' });
    } finally {
      setSendingBulkReports(false);
    }
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return 'N/A';
    return `$${value.toFixed(2)}`;
  };

  const formatPercentage = (value: number | null | undefined) => {
    if (value === null || value === undefined) return 'N/A';
    return `${value.toFixed(2)}%`;
  };

  const formatDateToMMDDYYYY = (dateString: string | null | undefined) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const handleSendAlert = async (jobId: number, jobName: string) => {
    try {
      // Buscar el job en filteredJobs
      const job = filteredJobs.find((j: any) => j.id === jobId);
      if (!job) {
        enqueueSnackbar('Job not found', { variant: 'error' });
        return;
      }

      // Preparar el job con la misma estructura que el bulk
      const jobToSend = {
        job_id: job.id || 0,
        branch: job.branch?.name || '',
        job_name: job.name || '',
        sales_person: job.estimator || '',
        crew_leader: job.crew_leader?.name || '',
        closing_date: formatDateToMMDDYYYY(job.closing_date),
        at_estimated_hours: job.at_estimated_hours || 0,
        total_hours_worked: job.total_worked_hours || 0,
        hours_saved: job.total_saved_hours || 0
      };

      // Enviar como array a Make.com
      const response = await fetch('/api/overrun-reports/send-bulk-to-make', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ jobs: [jobToSend] }) // Array con 1 solo job
      });

      if (!response.ok) {
        throw new Error('Failed to send job to Make.com');
      }

      const alertMessage = job.overrun_alert_sent 
        ? `Additional overrun alert sent for "${jobName}" (1 automatic alert was already sent)`
        : `Overrun alert sent for "${jobName}"`;
      
      enqueueSnackbar(alertMessage, { variant: 'success' });
      // Recargar jobs para actualizar el estado del botón
      loadOverrunJobs();
    } catch (error: any) {
      console.error('Error sending overrun alert:', error);
      enqueueSnackbar(error?.message || 'Failed to send overrun alert', { variant: 'error' });
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

  const handleOpenDetailsModal = (job: any) => {
    setSelectedJobId(job.id);
    setDetailsModalOpen(true);
  };

  const handleCloseDetailsModal = () => {
    setDetailsModalOpen(false);
    setSelectedJobId(null);
  };

  const handleOpenPostModal = (job: any) => {
    setSelectedPost({
      jobId: job.id,
      jobName: job.name,
      branchName: job.branch?.name || 'N/A',
      post: job.operation_post?.post || null,
      atEstimatedHours: job.at_estimated_hours,
      totalWorkedHours: job.total_worked_hours,
      actualPercentSaved: job.actual_percent_saved
    });
    setPostCrewLeader(job.crew_leader_name || '');
    setPostAnimal('');
    setPostNotes('');
    setPostModalOpen(true);
  };

  const handleClosePostModal = () => {
    setPostModalOpen(false);
    setSelectedPost(null);
    setPostCrewLeader('');
    setPostAnimal('');
    setPostNotes('');
  };

  const handleGeneratePost = async () => {
    if (!selectedPost) return;
    
    try {
      setGeneratingPost(true);
      const resp = await generateOperationPost(
        selectedPost.jobId, 
        postNotes,
        postCrewLeader,
        postAnimal
      );
      
      if (!resp.eligible) {
        enqueueSnackbar('This job does not meet the minimum % to post.', { variant: 'warning' });
      } else {
        setSelectedPost(prev => prev ? { ...prev, post: resp.post || '' } : null);
        enqueueSnackbar('Operation Command Post generated successfully!', { variant: 'success' });
        // Reload jobs to get the updated post
        loadOverrunJobs();
      }
    } catch (error: any) {
      console.error('Error generating post:', error);
      enqueueSnackbar(error?.response?.data?.message || 'Failed to generate post', { variant: 'error' });
    } finally {
      setGeneratingPost(false);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
    setPage(0); // Reset page when changing tabs
  };

  // Filtrar jobs según el tab actual
  const filteredJobs = jobs.filter((job: any) => {
    // Excluir jobs sin horas trabajadas (aún no tienen shifts cargados)
    if ((job.total_worked_hours || 0) === 0) {
      return false;
    }

    // Filtrar por tab
    let passesTabFilter = false;
    if (currentTab === 0) {
      // Tab "Overrun Jobs": mostrar jobs con actual_percent_saved < 0
      passesTabFilter = (job.actual_percent_saved || 0) < 0;
    } else {
      // Tab "Operation Command": mostrar jobs con actual_percent_saved > 15
      passesTabFilter = (job.actual_percent_saved || 0) > 15;
    }

    if (!passesTabFilter) return false;

    // Filtrar por "sin reporte/post"
    if (showOnlyWithoutReport) {
      if (currentTab === 0) {
        // Overrun Jobs: verificar si NO tiene overrun_report
        return !job.overrun_report || !job.overrun_report.report;
      } else {
        // Operation Command: verificar si NO tiene operation_post
        return !job.operation_post || !job.operation_post.post;
      }
    }

    return true;
  });

  return (
    <Box>
      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={currentTab} onChange={handleTabChange}>
          <Tab label="Overrun Jobs" />
          <Tab label="Operation Command" />
        </Tabs>
      </Paper>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {currentTab === 0 
          ? 'Jobs where total worked hours exceeded AT estimated hours (% Actual Saved < 0%)'
          : 'Jobs eligible for Operation Command posting (% Actual Saved > 15%)'}
      </Typography>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Filters</Typography>
          {selectedJobs.size > 0 && (
            <Button
              variant="contained"
              color="primary"
              startIcon={sendingBulkReports ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
              onClick={handleSendBulkReports}
              disabled={sendingBulkReports}
            >
              {sendingBulkReports ? 'Sending...' : `Send ${selectedJobs.size} to Make.com`}
            </Button>
          )}
        </Box>
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

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Select Month</InputLabel>
            <Select
              value={selectedMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              label="Select Month"
            >
              <MenuItem value="">All Months</MenuItem>
              {getMonthYearOptions().map((monthYear) => (
                <MenuItem key={monthYear} value={monthYear}>
                  {formatMonthYearLabel(monthYear)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="From Date"
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              // Si se cambia manualmente la fecha, limpiar el selector de mes
              if (selectedMonth) {
                setSelectedMonth('');
              }
            }}
            size="small"
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            label="To Date"
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              // Si se cambia manualmente la fecha, limpiar el selector de mes
              if (selectedMonth) {
                setSelectedMonth('');
              }
            }}
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
        
        <FormControlLabel
          control={
            <Checkbox
              checked={showOnlyWithoutReport}
              onChange={(e) => setShowOnlyWithoutReport(e.target.checked)}
            />
          }
          label={currentTab === 0 ? "Show only jobs without report" : "Show only jobs without post"}
        />
      </Paper>

      {/* Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selectedJobs.size > 0 && selectedJobs.size < filteredJobs.length}
                    checked={filteredJobs.length > 0 && selectedJobs.size === filteredJobs.length}
                    onChange={handleSelectAll}
                  />
                </TableCell>
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
                <TableCell sx={{ fontWeight: 'bold' }} align="center">{currentTab === 0 ? 'Report' : 'Post'}</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="center">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={13} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : filteredJobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} align="center">
                    <Typography variant="body2" color="text.secondary">
                      {currentTab === 0 ? 'No overrun jobs found' : 'No jobs eligible for Operation Command'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredJobs.map((job: any) => (
                  <TableRow 
                    key={job.id} 
                    hover
                    selected={selectedJobs.has(job.id)}
                  >
                    <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedJobs.has(job.id)}
                        onChange={() => handleSelectJob(job.id)}
                      />
                    </TableCell>
                    <TableCell 
                      onClick={() => handleOpenDetailsModal(job)}
                      sx={{ cursor: 'pointer' }}
                    >
                      {job.name}
                    </TableCell>
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
                        color={
                          currentTab === 1 && (job.total_saved_hours || 0) > 0
                            ? 'success'
                            : (job.total_saved_hours || 0) < 0
                            ? 'error'
                            : 'default'
                        }
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        label={formatPercentage(job.actual_percent_saved)}
                        size="small"
                        color={
                          currentTab === 1 && (job.actual_percent_saved || 0) > 0
                            ? 'success'
                            : (job.actual_percent_saved || 0) < 0
                            ? 'error'
                            : 'default'
                        }
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        label={formatCurrency(job.job_bonus_pool)}
                        size="small"
                        color={
                          currentTab === 1 && (job.job_bonus_pool || 0) > 0
                            ? 'success'
                            : (job.job_bonus_pool || 0) < 0
                            ? 'error'
                            : 'default'
                        }
                      />
                    </TableCell>
                    <TableCell align="center">
                      {currentTab === 0 ? (
                        // Overrun Jobs tab - show report
                        job.overrun_report ? (
                          <Tooltip title="View Report">
                            <IconButton
                              color="success"
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenReport(job);
                              }}
                            >
                              <DescriptionIcon />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            No Report
                          </Typography>
                        )
                      ) : (
                        // Operation Command tab - show post
                        job.operation_post ? (
                          <Tooltip title="View Post">
                            <IconButton
                              color="success"
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenPostModal(job);
                              }}
                            >
                              <DescriptionIcon />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            No Post
                          </Typography>
                        )
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {currentTab === 0 ? (
                        // Overrun Jobs tab - send alert
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {job.overrun_alert_sent && (
                            <Chip 
                              label="Alert Sent" 
                              size="small" 
                              color="success" 
                              variant="outlined"
                              sx={{ fontSize: '0.7rem', height: '20px' }}
                            />
                          )}
                          <Tooltip title={
                            job.overrun_report 
                              ? "Report already generated" 
                              : job.overrun_alert_sent 
                                ? "Send another alert (1 automatic alert already sent)" 
                                : "Send Overrun Alert"
                          }>
                            <span>
                              <IconButton
                                color="error"
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSendAlert(job.id, job.name);
                                }}
                                disabled={!!job.overrun_report}
                              >
                                <SendIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Box>
                      ) : (
                        // Operation Command tab - generate post
                        <Tooltip title="Generate Operation Post">
                          <IconButton
                            color="primary"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenPostModal(job);
                            }}
                          >
                            <SendIcon />
                          </IconButton>
                        </Tooltip>
                      )}
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
          count={filteredJobs.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* Job Details Modal */}
      <JobDetailsModalSimple
        jobId={selectedJobId}
        open={detailsModalOpen}
        onClose={handleCloseDetailsModal}
      />

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

      {/* Operation Command Post Modal */}
      <Dialog
        open={postModalOpen}
        onClose={handleClosePostModal}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
            Generate Operation Command Post
          </Typography>
          <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 500 }}>
            {selectedPost?.jobName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {selectedPost?.branchName} Branch
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {/* Job Metrics Display */}
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                Job Performance Metrics
              </Typography>
              <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    AT Estimated Hours
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    {selectedPost?.atEstimatedHours?.toFixed(2) || 'N/A'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Worked Hours
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    {selectedPost?.totalWorkedHours?.toFixed(2) || 'N/A'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    % Actual Saved
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                    {selectedPost?.actualPercentSaved !== undefined ? `${selectedPost.actualPercentSaved.toFixed(2)}%` : 'N/A'}
                  </Typography>
                </Box>
              </Stack>
            </Paper>

            {/* Editable Fields */}
            <TextField
              label="Crew Leader Name *"
              fullWidth
              value={postCrewLeader}
              onChange={(e) => setPostCrewLeader(e.target.value)}
              placeholder="e.g., Tyler Rodas"
              helperText="Enter the crew leader name for the post"
              required
            />
            <TextField
              label="Animal"
              fullWidth
              value={postAnimal}
              onChange={(e) => setPostAnimal(e.target.value.toUpperCase())}
              placeholder="e.g., BEAR, WOLF, EAGLE"
              helperText="Enter the animal emoji identifier (optional)"
            />
            <TextField
              label="Special Notes (optional)"
              fullWidth
              multiline
              rows={2}
              value={postNotes}
              onChange={(e) => setPostNotes(e.target.value)}
              placeholder="e.g., emphasize speed, mention 2 Day Banger, no banger"
            />
            
            {selectedPost?.post && (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                    Generated Post:
                  </Typography>
                  <Chip 
                    label="Saved in Database" 
                    size="small" 
                    color="success" 
                    variant="outlined"
                  />
                </Box>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
                  <Typography
                    component="pre"
                    sx={{
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'inherit',
                      fontSize: '0.95rem',
                      wordBreak: 'break-word',
                      m: 0
                    }}
                  >
                    {selectedPost.post}
                  </Typography>
                </Paper>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePostModal} color="inherit">
            Close
          </Button>
          {selectedPost?.post && (
            <Button
              onClick={() => {
                navigator.clipboard.writeText(selectedPost.post || '');
                enqueueSnackbar('Post copied to clipboard!', { variant: 'success' });
              }}
              color="secondary"
            >
              Copy Post
            </Button>
          )}
          <Button
            onClick={handleGeneratePost}
            variant="contained"
            color="primary"
            disabled={generatingPost || !postCrewLeader}
            startIcon={selectedPost?.post && !generatingPost ? <RefreshIcon /> : undefined}
          >
            {generatingPost ? 'Generating...' : selectedPost?.post ? 'Regenerate Post' : 'Generate Post'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OverrunJobs;

