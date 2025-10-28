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
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Collapse,
  IconButton,
  Stack,
  Divider,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete
} from '@mui/material';
import {
  KeyboardArrowDown as ExpandMoreIcon,
  KeyboardArrowUp as ExpandLessIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import performanceService from '../services/performanceService';
import branchService from '../services/branchService';
import employeeService from '../services/employeeService';

interface Shift {
  crew_member_id: number;
  employee_id: number;
  employee_name: string;
  hours: number;
  performance_status: string;
}

interface SpecialShift {
  special_shift_id: number;
  shift_type: string;
  hours: number;
  approved_shift: boolean;
}

interface PendingJob {
  id: number;
  name: string;
  closing_date: string;
  sold_price: number | null;
  branch: {
    id: number;
    name: string;
  } | null;
  crew_leader: {
    id: number;
    name: string;
  } | null;
  status: {
    id: number;
    name: string;
  } | null;
  estimator: string | null;
  shifts_count: number;
  total_hours: number;
  crew_count: number;
  shifts: Shift[];
  specialShifts?: SpecialShift[]; // QC shifts
}

interface Branch {
  id: number;
  name: string;
}

interface EditingShift {
  jobId: number;
  shiftIndex: number;
}

interface EditFormData {
  hours: number;
}

interface NewShiftData {
  crew_member_name: string;
  hours: number;
}

interface NewQCShiftData {
  hours: number;
}

const PerformanceApproval: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [pendingJobs, setPendingJobs] = useState<PendingJob[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<number | ''>('');
  const [selectedJobs, setSelectedJobs] = useState<Set<number>>(new Set());
  const [expandedJobs, setExpandedJobs] = useState<Set<number>>(new Set());
  const [selectedShiftsToReject, setSelectedShiftsToReject] = useState<Set<string>>(new Set());
  
  // Estados para edición inline
  const [editingShift, setEditingShift] = useState<EditingShift | null>(null);
  const [editFormData, setEditFormData] = useState<EditFormData>({ hours: 0 });
  
  // Estados para agregar shift regular
  const [addShiftModalOpen, setAddShiftModalOpen] = useState(false);
  const [selectedJobForNewShift, setSelectedJobForNewShift] = useState<number | null>(null);
  const [newShiftData, setNewShiftData] = useState<NewShiftData>({
    crew_member_name: '',
    hours: 0
  });
  
  // Estados para agregar QC shift
  const [addQCShiftModalOpen, setAddQCShiftModalOpen] = useState(false);
  const [selectedJobForNewQC, setSelectedJobForNewQC] = useState<number | null>(null);
  const [newQCShiftData, setNewQCShiftData] = useState<NewQCShiftData>({
    hours: 3 // Default 3 hours
  });
  
  // Estados para employees (crew members)
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  useEffect(() => {
    loadBranches();
    loadPendingJobs();
    loadEmployees();
  }, []);

  // Helper para formatear el performance status
  const formatPerformanceStatus = (status: string) => {
    const statusMap: { [key: string]: { label: string; color: 'warning' | 'success' | 'error' | 'default' } } = {
      'pending_approval': { label: 'Pending Approval', color: 'warning' },
      'approved': { label: 'Approved', color: 'success' },
      'rejected': { label: 'Rejected', color: 'error' },
      'synced': { label: 'Synced', color: 'success' }
    };
    return statusMap[status] || { label: status, color: 'default' };
  };

  const loadBranches = async () => {
    try {
      const response = await branchService.getBranches({ limit: 100 });
      if (response && response.branches) {
        const filteredBranches = response.branches.filter((b: Branch) => b.name !== 'Corporate');
        setBranches(filteredBranches);
      }
    } catch (error) {
      console.error('Error loading branches:', error);
    }
  };

  const loadEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const response = await employeeService.getAll({ limit: 1000 });
      if (response && response.data && Array.isArray(response.data)) {
        // Filtrar solo crew_member y crew_leader
        const crewMembers = response.data.filter(
          emp => emp.role === 'crew_member' || emp.role === 'crew_leader'
        );
        setAllEmployees(crewMembers);
      } else {
        console.warn('Invalid employees data:', response);
        setAllEmployees([]);
      }
    } catch (error: any) {
      console.error('Error loading employees:', error);
      setAllEmployees([]);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const loadPendingJobs = async (branchId?: number) => {
    setLoading(true);
    try {
      const response = await performanceService.getPendingApproval(branchId);
      console.log('Pending approval response:', response);
      if (response && response.data && response.data.jobs) {
        // Separar regular shifts y special shifts
        const processedJobs = response.data.jobs.map((job: any) => {
          const regularShifts: Shift[] = [];
          const specialShifts: SpecialShift[] = [];
          
          if (job.shifts && Array.isArray(job.shifts)) {
            job.shifts.forEach((shift: any) => {
              if (shift.type === 'regular') {
                regularShifts.push({
                  crew_member_id: shift.crew_member_id,
                  employee_id: shift.employee_id,
                  employee_name: shift.employee_name,
                  hours: shift.hours,
                  performance_status: shift.performance_status
                });
              } else if (shift.type === 'special') {
                specialShifts.push({
                  special_shift_id: shift.special_shift_id,
                  shift_type: shift.special_shift_name || 'QC',
                  hours: shift.hours,
                  approved_shift: shift.approved || false
                });
              }
            });
          }
          
          return {
            ...job,
            shifts: regularShifts,
            specialShifts: specialShifts
          };
        });
        
        setPendingJobs(processedJobs);
      } else if (response && response.jobs) {
        // Fallback por si el formato cambia
        setPendingJobs(response.jobs);
      }
    } catch (error: any) {
      console.error('Error loading pending jobs:', error);
      enqueueSnackbar(error.message || 'Error loading pending jobs', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleBranchChange = (branchId: number | '') => {
    setSelectedBranch(branchId);
    loadPendingJobs(branchId === '' ? undefined : branchId);
  };

  const handleToggleJobSelection = (jobId: number) => {
    const newSelected = new Set(selectedJobs);
    if (newSelected.has(jobId)) {
      newSelected.delete(jobId);
    } else {
      newSelected.add(jobId);
    }
    setSelectedJobs(newSelected);
  };

  const handleSelectAllJobs = () => {
    setSelectedJobs(new Set(pendingJobs.map(j => j.id)));
  };

  const handleDeselectAllJobs = () => {
    setSelectedJobs(new Set());
  };

  const handleToggleShiftSelection = (jobId: number, crewMemberId: number) => {
    const shiftKey = `${jobId}-${crewMemberId}`;
    const newSelected = new Set(selectedShiftsToReject);
    if (newSelected.has(shiftKey)) {
      newSelected.delete(shiftKey);
    } else {
      newSelected.add(shiftKey);
    }
    setSelectedShiftsToReject(newSelected);
  };

  const handleExpandJob = (jobId: number) => {
    const newExpanded = new Set(expandedJobs);
    if (newExpanded.has(jobId)) {
      newExpanded.delete(jobId);
    } else {
      newExpanded.add(jobId);
    }
    setExpandedJobs(newExpanded);
  };

  // Edición inline de shifts
  const handleEditShift = (jobId: number, shiftIndex: number, currentHours: number) => {
    setEditingShift({ jobId, shiftIndex });
    setEditFormData({ hours: currentHours });
  };

  const handleCancelEdit = () => {
    setEditingShift(null);
    setEditFormData({ hours: 0 });
  };

  const handleSaveEdit = () => {
    if (!editingShift) return;

    // Actualizar el shift en el estado local
    const updatedJobs = pendingJobs.map(job => {
      if (job.id === editingShift.jobId) {
        const updatedShifts = [...job.shifts];
        updatedShifts[editingShift.shiftIndex] = {
          ...updatedShifts[editingShift.shiftIndex],
          hours: editFormData.hours
        };
        
        // Recalcular total_hours
        const newTotalHours = updatedShifts.reduce((sum, s) => sum + s.hours, 0);
        
        return {
          ...job,
          shifts: updatedShifts,
          total_hours: newTotalHours
        };
      }
      return job;
    });

    setPendingJobs(updatedJobs);
    setEditingShift(null);
    enqueueSnackbar('Shift updated (save changes to persist)', { variant: 'info' });
  };

  // Eliminar shift
  const handleDeleteShift = (jobId: number, shiftIndex: number) => {
    const updatedJobs = pendingJobs.map(job => {
      if (job.id === jobId) {
        const updatedShifts = job.shifts.filter((_, idx) => idx !== shiftIndex);
        const newTotalHours = updatedShifts.reduce((sum, s) => sum + s.hours, 0);
        
        return {
          ...job,
          shifts: updatedShifts,
          total_hours: newTotalHours,
          shifts_count: updatedShifts.length,
          crew_count: new Set(updatedShifts.map(s => s.employee_id)).size
        };
      }
      return job;
    });

    setPendingJobs(updatedJobs);
    enqueueSnackbar('Shift removed (save changes to persist)', { variant: 'info' });
  };

  // Agregar nuevo shift
  const handleOpenAddShift = (jobId: number) => {
    setSelectedJobForNewShift(jobId);
    setNewShiftData({ crew_member_name: '', hours: 0 });
    setAddShiftModalOpen(true);
  };

  const handleAddShift = () => {
    if (!selectedJobForNewShift || !newShiftData.crew_member_name || newShiftData.hours <= 0) {
      enqueueSnackbar('Please fill all fields', { variant: 'warning' });
      return;
    }

    const updatedJobs = pendingJobs.map(job => {
      if (job.id === selectedJobForNewShift) {
        const newShift: Shift = {
          crew_member_id: 0, // Temporal, se asignará en el backend
          employee_id: 0,
          employee_name: newShiftData.crew_member_name,
          hours: newShiftData.hours,
          performance_status: 'pending_approval'
        };
        
        const updatedShifts = [...job.shifts, newShift];
        const newTotalHours = updatedShifts.reduce((sum, s) => sum + s.hours, 0);
        
        return {
          ...job,
          shifts: updatedShifts,
          total_hours: newTotalHours,
          shifts_count: updatedShifts.length,
          crew_count: new Set(updatedShifts.map(s => s.employee_id)).size
        };
      }
      return job;
    });

    setPendingJobs(updatedJobs);
    setAddShiftModalOpen(false);
    enqueueSnackbar('Shift added (save changes to persist)', { variant: 'success' });
  };

  // Agregar QC shift
  const handleOpenAddQCShift = (jobId: number) => {
    setSelectedJobForNewQC(jobId);
    setNewQCShiftData({ hours: 3 }); // Default 3 hours
    setAddQCShiftModalOpen(true);
  };

  const handleAddQCShift = () => {
    if (!selectedJobForNewQC || newQCShiftData.hours <= 0) {
      enqueueSnackbar('Please enter valid hours', { variant: 'warning' });
      return;
    }

    const updatedJobs = pendingJobs.map(job => {
      if (job.id === selectedJobForNewQC) {
        const newQCShift: SpecialShift = {
          special_shift_id: 1, // QC shift ID (assumed to be 1, verify in DB)
          shift_type: 'QC',
          hours: newQCShiftData.hours,
          approved_shift: false
        };
        
        const updatedSpecialShifts = [...(job.specialShifts || []), newQCShift];
        const qcTotalHours = updatedSpecialShifts.reduce((sum, s) => sum + s.hours, 0);
        const regularTotalHours = job.shifts.reduce((sum, s) => sum + s.hours, 0);
        
        return {
          ...job,
          specialShifts: updatedSpecialShifts,
          total_hours: regularTotalHours + qcTotalHours
        };
      }
      return job;
    });

    setPendingJobs(updatedJobs);
    setAddQCShiftModalOpen(false);
    enqueueSnackbar('QC shift added (save changes to persist)', { variant: 'success' });
  };

  const handleApproveSelected = async () => {
    if (selectedJobs.size === 0) {
      enqueueSnackbar('Please select at least one job', { variant: 'warning' });
      return;
    }

    setApproving(true);
    try {
      await performanceService.approveJobs(Array.from(selectedJobs));
      enqueueSnackbar(`${selectedJobs.size} job(s) approved successfully`, { variant: 'success' });
      
      // Recargar lista
      await loadPendingJobs(selectedBranch === '' ? undefined : selectedBranch);
      setSelectedJobs(new Set());
    } catch (error: any) {
      console.error('Error approving jobs:', error);
      enqueueSnackbar(error.message || 'Error approving jobs', { variant: 'error' });
    } finally {
      setApproving(false);
    }
  };

  const handleRejectSelectedShifts = async () => {
    if (selectedShiftsToReject.size === 0) {
      enqueueSnackbar('Please select at least one shift to reject', { variant: 'warning' });
      return;
    }

    setApproving(true);
    try {
      const shiftsToReject = Array.from(selectedShiftsToReject).map(key => {
        const [jobId, crewMemberId] = key.split('-').map(Number);
        return { crew_member_id: crewMemberId, job_id: jobId };
      });

      await performanceService.rejectShifts(shiftsToReject);
      enqueueSnackbar(`${shiftsToReject.length} shift(s) rejected successfully`, { variant: 'success' });
      
      // Recargar lista
      await loadPendingJobs(selectedBranch === '' ? undefined : selectedBranch);
      setSelectedShiftsToReject(new Set());
    } catch (error: any) {
      console.error('Error rejecting shifts:', error);
      enqueueSnackbar(error.message || 'Error rejecting shifts', { variant: 'error' });
    } finally {
      setApproving(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Review and approve jobs and shifts imported from Performance before they appear in the Jobs list. 
        Jobs and shifts will remain here until you approve or reject them.
      </Typography>

      {/* Filtros */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Filter by Branch</InputLabel>
          <Select
            value={selectedBranch}
            label="Filter by Branch"
            onChange={(e) => handleBranchChange(e.target.value as number | '')}
          >
            <MenuItem value="">All Branches</MenuItem>
            {branches.map(branch => (
              <MenuItem key={branch.id} value={branch.id}>{branch.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => loadPendingJobs(selectedBranch === '' ? undefined : selectedBranch)}
          disabled={loading}
        >
          Refresh
        </Button>
      </Stack>

      {/* Botones de acción */}
      {pendingJobs.length > 0 && (
        <>
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <Button
              size="small"
              onClick={handleSelectAllJobs}
              disabled={selectedJobs.size === pendingJobs.length}
            >
              Select All
            </Button>
            <Button
              size="small"
              onClick={handleDeselectAllJobs}
              disabled={selectedJobs.size === 0}
            >
              Deselect All
            </Button>
          </Stack>

          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>{pendingJobs.length} job(s)</strong> pending approval with{' '}
              <strong>{pendingJobs.reduce((sum, j) => sum + j.shifts_count, 0)} shift(s)</strong> total.
            </Typography>
          </Alert>

          <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
            <Button
              variant="contained"
              color="success"
              startIcon={approving ? <CircularProgress size={20} color="inherit" /> : <ApproveIcon />}
              onClick={handleApproveSelected}
              disabled={approving || selectedJobs.size === 0}
            >
              {approving ? 'Approving...' : `Approve ${selectedJobs.size} Job(s)`}
            </Button>
            <Button
              variant="contained"
              color="error"
              startIcon={approving ? <CircularProgress size={20} color="inherit" /> : <RejectIcon />}
              onClick={handleRejectSelectedShifts}
              disabled={approving || selectedShiftsToReject.size === 0}
            >
              {approving ? 'Rejecting...' : `Reject ${selectedShiftsToReject.size} Shift(s)`}
            </Button>
          </Stack>
        </>
      )}

      {/* Tabla de jobs */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : pendingJobs.length === 0 ? (
        <Alert severity="success">
          <Typography>No pending jobs to approve. All caught up! 🎉</Typography>
        </Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedJobs.size === pendingJobs.length && pendingJobs.length > 0}
                    indeterminate={selectedJobs.size > 0 && selectedJobs.size < pendingJobs.length}
                    onChange={(e) => e.target.checked ? handleSelectAllJobs() : handleDeselectAllJobs()}
                  />
                </TableCell>
                <TableCell>Job Name</TableCell>
                <TableCell>Branch</TableCell>
                <TableCell>Crew Leader</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Shifts</TableCell>
                <TableCell>Total Hours</TableCell>
                <TableCell>Crew Size</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pendingJobs.map((job) => {
                const isExpanded = expandedJobs.has(job.id);
                const isSelected = selectedJobs.has(job.id);

                return (
                  <React.Fragment key={job.id}>
                    <TableRow hover selected={isSelected}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={isSelected}
                          onChange={() => handleToggleJobSelection(job.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {job.name}
                        </Typography>
                        {job.sold_price && typeof job.sold_price === 'number' && (
                          <Typography variant="caption" color="success.main">
                            ${job.sold_price.toFixed(2)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{job.branch?.name || 'N/A'}</TableCell>
                      <TableCell>{job.crew_leader?.name || 'N/A'}</TableCell>
                      <TableCell>
                        {job.status ? (
                          <Chip label={job.status.name} size="small" color="default" />
                        ) : (
                          'N/A'
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip label={job.shifts_count} size="small" color="info" />
                      </TableCell>
                      <TableCell>
                        <Chip label={`${job.total_hours.toFixed(2)} hrs`} size="small" color="success" />
                      </TableCell>
                      <TableCell>
                        <Chip label={job.crew_count} size="small" color="primary" />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handleExpandJob(job.id)}
                        >
                          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </TableCell>
                    </TableRow>

                    {/* Shifts expandibles */}
                    <TableRow>
                      <TableCell colSpan={9} sx={{ p: 0 }}>
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ p: 2, bgcolor: 'background.default' }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                              <Typography variant="h6">
                                Shifts for {job.name}
                              </Typography>
                              <Stack direction="row" spacing={1}>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<AddIcon />}
                                  onClick={() => handleOpenAddShift(job.id)}
                                >
                                  Add Shift
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="warning"
                                  startIcon={<AddIcon />}
                                  onClick={() => handleOpenAddQCShift(job.id)}
                                >
                                  Add QC Shift
                                </Button>
                              </Stack>
                            </Stack>

                            <TableContainer component={Paper} variant="outlined">
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell padding="checkbox">Reject</TableCell>
                                    <TableCell>Crew Member</TableCell>
                                    <TableCell>Hours</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {job.shifts.map((shift, shiftIndex) => {
                                    const isEditing = editingShift?.jobId === job.id && editingShift?.shiftIndex === shiftIndex;
                                    const shiftKey = `${job.id}-${shift.crew_member_id}`;
                                    const isShiftSelected = selectedShiftsToReject.has(shiftKey);

                                    return (
                                      <TableRow key={shiftIndex} hover>
                                        <TableCell padding="checkbox">
                                          <Checkbox
                                            checked={isShiftSelected}
                                            onChange={() => handleToggleShiftSelection(job.id, shift.crew_member_id)}
                                          />
                                        </TableCell>
                                        <TableCell>{shift.employee_name}</TableCell>
                                        <TableCell>
                                          {isEditing ? (
                                            <TextField
                                              type="number"
                                              size="small"
                                              value={editFormData.hours}
                                              onChange={(e) => setEditFormData({ hours: Number(e.target.value) })}
                                              sx={{ width: 100 }}
                                              inputProps={{ min: 0, step: 0.25 }}
                                            />
                                          ) : (
                                            shift.hours.toFixed(2)
                                          )}
                                        </TableCell>
                                        <TableCell>
                                          {(() => {
                                            const statusInfo = formatPerformanceStatus(shift.performance_status);
                                            return (
                                              <Chip
                                                label={statusInfo.label}
                                                size="small"
                                                color={statusInfo.color}
                                              />
                                            );
                                          })()}
                                        </TableCell>
                                        <TableCell align="right">
                                          {isEditing ? (
                                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                                              <IconButton
                                                size="small"
                                                color="primary"
                                                onClick={handleSaveEdit}
                                              >
                                                <SaveIcon fontSize="small" />
                                              </IconButton>
                                              <IconButton
                                                size="small"
                                                onClick={handleCancelEdit}
                                              >
                                                <CloseIcon fontSize="small" />
                                              </IconButton>
                                            </Stack>
                                          ) : (
                                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                                              <IconButton
                                                size="small"
                                                onClick={() => handleEditShift(job.id, shiftIndex, shift.hours)}
                                              >
                                                <EditIcon fontSize="small" />
                                              </IconButton>
                                              <IconButton
                                                size="small"
                                                color="error"
                                                onClick={() => handleDeleteShift(job.id, shiftIndex)}
                                              >
                                                <DeleteIcon fontSize="small" />
                                              </IconButton>
                                            </Stack>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </TableContainer>

                            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body2" color="text.secondary">
                                Estimator: {job.estimator || 'N/A'}
                              </Typography>
                              <Typography variant="body2" fontWeight="bold">
                                Total Hours: {job.total_hours.toFixed(2)}
                              </Typography>
                            </Box>

                            {/* Special Shifts (QC) Section */}
                            {job.specialShifts && job.specialShifts.length > 0 && (
                              <Box sx={{ mt: 3 }}>
                                <Typography variant="h6" sx={{ mb: 1 }}>
                                  Special Shifts (QC)
                                </Typography>
                                <TableContainer component={Paper} variant="outlined">
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow>
                                        <TableCell>Type</TableCell>
                                        <TableCell>Hours</TableCell>
                                        <TableCell>Status</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {job.specialShifts.map((qcShift, index) => (
                                        <TableRow key={index}>
                                          <TableCell>
                                            <Chip label={qcShift.shift_type} size="small" color="warning" />
                                          </TableCell>
                                          <TableCell>{qcShift.hours.toFixed(2)}</TableCell>
                                          <TableCell>
                                            {qcShift.approved_shift ? (
                                              <Chip label="Approved" size="small" color="success" />
                                            ) : (
                                              <Chip label="Pending" size="small" color="warning" />
                                            )}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </TableContainer>
                                <Typography variant="body2" sx={{ mt: 1, fontWeight: 'bold', color: 'warning.main' }}>
                                  Total QC Hours: {job.specialShifts.reduce((sum, s) => sum + s.hours, 0).toFixed(2)}
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Modal para agregar shift */}
      <Dialog open={addShiftModalOpen} onClose={() => setAddShiftModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Shift</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Autocomplete
              options={allEmployees}
              getOptionLabel={(option) => {
                if (typeof option === 'string') return option;
                const statusLabel = option.status !== 'active' ? ` (${option.status})` : '';
                return `${option.first_name} ${option.last_name}${statusLabel}`;
              }}
              loading={loadingEmployees}
              value={allEmployees.find(emp => `${emp.first_name} ${emp.last_name}` === newShiftData.crew_member_name) || null}
              onChange={(_, newValue) => {
                if (newValue) {
                  setNewShiftData({
                    ...newShiftData, 
                    crew_member_name: `${newValue.first_name} ${newValue.last_name}`
                  });
                } else {
                  setNewShiftData({...newShiftData, crew_member_name: ''});
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Crew Member"
                  required
                  autoFocus
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingEmployees ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              fullWidth
            />
            <TextField
              label="Hours"
              type="number"
              value={newShiftData.hours}
              onChange={(e) => setNewShiftData({ ...newShiftData, hours: Number(e.target.value) })}
              fullWidth
              required
              inputProps={{ min: 0, step: 0.25 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddShiftModalOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAddShift}
            startIcon={<AddIcon />}
          >
            Add Shift
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal para agregar QC shift */}
      <Dialog open={addQCShiftModalOpen} onClose={() => setAddQCShiftModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add QC Shift</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info">
              QC shifts are special shifts for Quality Control. Default is 3 hours per QC shift.
            </Alert>
            <TextField
              label="Hours"
              type="number"
              value={newQCShiftData.hours}
              onChange={(e) => setNewQCShiftData({ hours: Number(e.target.value) })}
              fullWidth
              required
              inputProps={{ min: 0, step: 0.25 }}
              helperText="Default: 3 hours. Adjust as needed."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddQCShiftModalOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleAddQCShift}
            startIcon={<AddIcon />}
          >
            Add QC Shift
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PerformanceApproval;
