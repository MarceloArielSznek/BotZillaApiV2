import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Button,
  Card,
  CardContent,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Chip,
  TablePagination,
  Collapse
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import shiftApprovalService, {
  type JobWithPendingShifts,
  type PendingShift,
  type PendingSpecialShift
} from '../services/shiftApprovalService';
import branchService from '../services/branchService';

const ShiftApproval: React.FC = () => {
  // Estados principales
  const [pendingJobs, setPendingJobs] = useState<JobWithPendingShifts[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Estados para filtros
  const [selectedBranch, setSelectedBranch] = useState<number | ''>('');
  const [branches, setBranches] = useState<Array<{id: number, name: string}>>([]);

  // Estados para paginación
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Estados para expansión de jobs
  const [expandedJobs, setExpandedJobs] = useState<Set<number>>(new Set());

  // Estados para selección
  const [selectedShifts, setSelectedShifts] = useState<Set<string>>(new Set());
  const [selectedSpecialShifts, setSelectedSpecialShifts] = useState<Set<string>>(new Set());
  const [selectedJobs, setSelectedJobs] = useState<Set<number>>(new Set());

  // Estados para confirmación
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: 'approve' | 'reject';
    jobName?: string;
    totalShifts: number;
  }>({
    open: false,
    action: 'approve',
    jobName: undefined,
    totalShifts: 0
  });

  // Funciones para generar claves únicas
  const getShiftKey = (shift: PendingShift): string => {
    return `regular-${shift.crew_member_id}-${shift.job_id}`;
  };

  const getSpecialShiftKey = (shift: PendingSpecialShift): string => {
    return `special-${shift.special_shift_id}-${shift.job_id}`;
  };

  // Toggle expansión de job
  const toggleJobExpansion = (jobId: number) => {
    const newExpanded = new Set(expandedJobs);
    if (newExpanded.has(jobId)) {
      newExpanded.delete(jobId);
    } else {
      newExpanded.add(jobId);
    }
    setExpandedJobs(newExpanded);
  };

  // Cargar datos iniciales
  useEffect(() => {
    loadInitialData();
  }, []);

  // Cargar shifts cuando cambia el branch filter (con debounce)
  useEffect(() => {
    if (branches.length > 0) {
      const timeoutId = setTimeout(() => {
        loadPendingShifts();
      }, 300);

      return () => clearTimeout(timeoutId);
    }
  }, [selectedBranch]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Cargar branches para el filtro (solo una vez)
      if (branches.length === 0) {
        try {
          const branchesResponse = await branchService.getBranches();
          setBranches(Array.isArray(branchesResponse.branches) ? branchesResponse.branches : []);
        } catch (branchError) {
          console.error('Error loading branches:', branchError);
          setBranches([]);
        }
      }

      // Cargar shifts pendientes
      await loadPendingShifts();

    } catch (err: any) {
      console.error('Error loading shift approval data:', err);
      setError('Failed to load shift approval data');
    } finally {
      setLoading(false);
    }
  };

  const loadPendingShifts = async () => {
    try {
      const pendingResponse = await shiftApprovalService.getPendingShifts({
        branch_id: selectedBranch || undefined,
        limit: 100
      });

      if (pendingResponse && pendingResponse.success) {
        setPendingJobs(Array.isArray(pendingResponse.data) ? pendingResponse.data : []);
      } else {
        console.warn('Pending shifts response was not successful or malformed:', pendingResponse);
        setPendingJobs([]);
      }
    } catch (err: any) {
      console.error('Error loading pending shifts:', err);
      setError('Failed to load pending shifts');
      setPendingJobs([]);
    }
  };

  // Manejar selección de job completo
  const handleJobSelection = (jobData: JobWithPendingShifts, checked: boolean) => {
    const newSelectedJobs = new Set(selectedJobs);
    const newSelectedShifts = new Set(selectedShifts);
    const newSelectedSpecialShifts = new Set(selectedSpecialShifts);
    
    if (checked) {
      newSelectedJobs.add(jobData.job.id);
      // Seleccionar todos los shifts regulares
      jobData.shifts.forEach(shift => {
        newSelectedShifts.add(getShiftKey(shift));
      });
      // Seleccionar todos los special shifts
      jobData.specialShifts?.forEach(shift => {
        newSelectedSpecialShifts.add(getSpecialShiftKey(shift));
      });
    } else {
      newSelectedJobs.delete(jobData.job.id);
      // Deseleccionar todos los shifts regulares
      jobData.shifts.forEach(shift => {
        newSelectedShifts.delete(getShiftKey(shift));
      });
      // Deseleccionar todos los special shifts
      jobData.specialShifts?.forEach(shift => {
        newSelectedSpecialShifts.delete(getSpecialShiftKey(shift));
      });
    }
    
    setSelectedJobs(newSelectedJobs);
    setSelectedShifts(newSelectedShifts);
    setSelectedSpecialShifts(newSelectedSpecialShifts);
  };

  // Verificar si un job está completamente seleccionado
  const isJobSelected = (jobData: JobWithPendingShifts): boolean => {
    const regularSelected = jobData.shifts.every(shift => selectedShifts.has(getShiftKey(shift)));
    const specialSelected = (jobData.specialShifts || []).every(shift => selectedSpecialShifts.has(getSpecialShiftKey(shift)));
    return regularSelected && specialSelected;
  };

  // Obtener datos de shifts seleccionados
  const getSelectedShiftsData = () => {
    const regularShifts = pendingJobs.flatMap(jobData => 
      jobData.shifts
        .filter(shift => selectedShifts.has(getShiftKey(shift)))
        .map(shift => ({ crew_member_id: shift.crew_member_id, job_id: shift.job_id }))
    );

    const specialShifts = pendingJobs.flatMap(jobData => 
      (jobData.specialShifts || [])
        .filter(shift => selectedSpecialShifts.has(getSpecialShiftKey(shift)))
        .map(shift => ({ special_shift_id: shift.special_shift_id, job_id: shift.job_id }))
    );

    return { regularShifts, specialShifts };
  };

  // Abrir diálogo de confirmación
  const openConfirmDialog = (action: 'approve' | 'reject', jobName?: string) => {
    const { regularShifts, specialShifts } = getSelectedShiftsData();
    const totalShifts = regularShifts.length + specialShifts.length;
    
    setConfirmDialog({
      open: true,
      action,
      jobName,
      totalShifts
    });
  };

  // Cerrar diálogo de confirmación
  const closeConfirmDialog = () => {
    setConfirmDialog({
      open: false,
      action: 'approve',
      jobName: undefined,
      totalShifts: 0
    });
  };

  // Ejecutar acción de aprobación/rechazo
  const executeAction = async () => {
    try {
      setActionLoading(true);
      const { regularShifts, specialShifts } = getSelectedShiftsData();

      if (confirmDialog.action === 'approve') {
        await shiftApprovalService.approveShifts(regularShifts, specialShifts);
        setSuccess(`${confirmDialog.totalShifts} shift(s) approved successfully`);
      } else {
        await shiftApprovalService.rejectShifts(regularShifts, specialShifts);
        setSuccess(`${confirmDialog.totalShifts} shift(s) rejected successfully`);
      }

      // Limpiar selecciones y recargar shifts
      setSelectedShifts(new Set());
      setSelectedSpecialShifts(new Set());
      setSelectedJobs(new Set());
      await loadPendingShifts();
      
    } catch (err: any) {
      setError(`Failed to ${confirmDialog.action} shifts: ${err.message}`);
    } finally {
      setActionLoading(false);
      closeConfirmDialog();
    }
  };

  // Aplicar paginación a jobs
  const paginatedJobs = pendingJobs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  // Obtener total de shifts
  const totalShifts = pendingJobs.reduce((sum, job) => sum + job.shifts.length + (job.specialShifts?.length || 0), 0);
  const selectedShiftsCount = selectedShifts.size + selectedSpecialShifts.size;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Refresh button */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mb: 2 }}>
        <Tooltip title="Refresh Pending Shifts">
          <IconButton onClick={loadPendingShifts}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Filter Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Filters</Typography>
            <Button
              size="small"
              onClick={() => setSelectedBranch('')}
              sx={{ ml: 'auto' }}
            >
              Clear filters
            </Button>
          </Box>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
            <FormControl fullWidth size="small" sx={{ flex: '1 1 200px' }}>
              <InputLabel>Branch</InputLabel>
              <Select 
                value={selectedBranch} 
                onChange={(e) => setSelectedBranch(e.target.value as number | '')} 
                label="Branch"
              >
                <MenuItem value=""><em>All Branches</em></MenuItem>
                {branches.map(branch => (
                  <MenuItem key={branch.id} value={branch.id}>{branch.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      {selectedShiftsCount > 0 && (
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            color="success"
            startIcon={<ApproveIcon />}
            onClick={() => openConfirmDialog('approve')}
            disabled={actionLoading}
          >
            Approve Selected ({selectedShiftsCount} shifts)
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<RejectIcon />}
            onClick={() => openConfirmDialog('reject')}
            disabled={actionLoading}
          >
            Reject Selected ({selectedShiftsCount} shifts)
          </Button>
        </Box>
      )}

      {/* Error/Success Messages */}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {/* Main Table - Collapsible Jobs */}
      {!loading && !error && (
        <Card>
          <CardContent sx={{ p: 0 }}>
            <TableContainer component={Paper}>
              <Table sx={{ minWidth: 650 }} aria-label="pending jobs table">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={selectedJobs.size > 0 && selectedJobs.size < pendingJobs.length}
                        checked={pendingJobs.length > 0 && selectedJobs.size === pendingJobs.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            pendingJobs.forEach(job => handleJobSelection(job, true));
                          } else {
                            setSelectedJobs(new Set());
                            setSelectedShifts(new Set());
                            setSelectedSpecialShifts(new Set());
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Job Name</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Branch</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Total Shifts</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Total Hours</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedJobs.map((jobData) => {
                    const totalRegularHours = jobData.shifts.reduce((sum, shift) => sum + parseFloat(shift.hours.toString()), 0);
                    const totalSpecialHours = (jobData.specialShifts || []).reduce((sum, shift) => sum + parseFloat(shift.hours.toString()), 0);
                    const totalHours = totalRegularHours + totalSpecialHours;
                    const totalShiftsCount = jobData.shifts.length + (jobData.specialShifts?.length || 0);
                    const isSelected = isJobSelected(jobData);
                    const isExpanded = expandedJobs.has(jobData.job.id);
                    
                    return (
                      <React.Fragment key={jobData.job.id}>
                        {/* Job Header Row */}
                        <TableRow hover sx={{ '& > *': { borderBottom: 'unset' } }}>
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={isSelected}
                              onChange={(e) => handleJobSelection(jobData, e.target.checked)}
                            />
                          </TableCell>
                          <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <IconButton
                                size="small"
                                onClick={() => toggleJobExpansion(jobData.job.id)}
                                sx={{ mr: 1 }}
                              >
                                {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                              </IconButton>
                              {jobData.job.name}
                            </Box>
                          </TableCell>
                          <TableCell>{jobData.job.branch?.name || 'N/A'}</TableCell>
                          <TableCell>
                            <Chip
                              label={`${totalShiftsCount} shift(s)`}
                              size="small"
                              color="info"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={`${totalHours.toFixed(1)}h`}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell sx={{ textAlign: 'center' }}>
                            <Tooltip title="Approve All Shifts for this Job">
                              <IconButton
                                onClick={() => {
                                  handleJobSelection(jobData, true);
                                  openConfirmDialog('approve', jobData.job.name);
                                }}
                                size="small"
                                color="success"
                              >
                                <ApproveIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Reject All Shifts for this Job">
                              <IconButton
                                onClick={() => {
                                  handleJobSelection(jobData, true);
                                  openConfirmDialog('reject', jobData.job.name);
                                }}
                                size="small"
                                color="error"
                              >
                                <RejectIcon />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                        
                        {/* Collapsible Content */}
                        <TableRow>
                          <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
                            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                              <Box sx={{ margin: 1 }}>
                                {/* Regular Shifts */}
                                {jobData.shifts.length > 0 && (
                                  <>
                                    <Typography variant="h6" gutterBottom component="div">
                                      Regular Shifts ({jobData.shifts.length})
                                    </Typography>
                                    <Table size="small">
                                      <TableHead>
                                        <TableRow>
                                          <TableCell padding="checkbox"></TableCell>
                                          <TableCell>Employee</TableCell>
                                          <TableCell>Role</TableCell>
                                          <TableCell>Hours</TableCell>
                                          <TableCell align="center">Actions</TableCell>
                                        </TableRow>
                                      </TableHead>
                                      <TableBody>
                                        {jobData.shifts.map((shift) => (
                                          <TableRow key={getShiftKey(shift)}>
                                            <TableCell padding="checkbox">
                                              <Checkbox
                                                checked={selectedShifts.has(getShiftKey(shift))}
                                                onChange={(e) => {
                                                  const newSelected = new Set(selectedShifts);
                                                  if (e.target.checked) {
                                                    newSelected.add(getShiftKey(shift));
                                                  } else {
                                                    newSelected.delete(getShiftKey(shift));
                                                  }
                                                  setSelectedShifts(newSelected);
                                                }}
                                                size="small"
                                              />
                                            </TableCell>
                                            <TableCell>{shift.crewMember.name}</TableCell>
                                            <TableCell>
                                              <Chip
                                                label={shift.crewMember.is_leader ? 'Leader' : 'Member'}
                                                size="small"
                                                color={shift.crewMember.is_leader ? 'secondary' : 'default'}
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <Chip
                                                label={`${shift.hours}h`}
                                                size="small"
                                                variant="outlined"
                                              />
                                            </TableCell>
                                            <TableCell align="center">
                                              <Tooltip title="Approve">
                                                <IconButton 
                                                  size="small" 
                                                  color="success"
                                                  onClick={() => {
                                                    // Seleccionar solo este shift
                                                    setSelectedShifts(new Set([getShiftKey(shift)]));
                                                    setSelectedSpecialShifts(new Set());
                                                    setSelectedJobs(new Set());
                                                    // Abrir diálogo de confirmación
                                                    setConfirmDialog({
                                                      open: true,
                                                      action: 'approve',
                                                      totalShifts: 1,
                                                      jobName: `${shift.crewMember.name} (${jobData.job.name})`
                                                    });
                                                  }}
                                                >
                                                  <ApproveIcon fontSize="small" />
                                                </IconButton>
                                              </Tooltip>
                                              <Tooltip title="Reject">
                                                <IconButton 
                                                  size="small" 
                                                  color="error"
                                                  onClick={() => {
                                                    // Seleccionar solo este shift
                                                    setSelectedShifts(new Set([getShiftKey(shift)]));
                                                    setSelectedSpecialShifts(new Set());
                                                    setSelectedJobs(new Set());
                                                    // Abrir diálogo de confirmación
                                                    setConfirmDialog({
                                                      open: true,
                                                      action: 'reject',
                                                      totalShifts: 1,
                                                      jobName: `${shift.crewMember.name} (${jobData.job.name})`
                                                    });
                                                  }}
                                                >
                                                  <RejectIcon fontSize="small" />
                                                </IconButton>
                                              </Tooltip>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </>
                                )}

                                {/* Special Shifts */}
                                {jobData.specialShifts && jobData.specialShifts.length > 0 && (
                                  <>
                                    <Typography variant="h6" gutterBottom component="div" sx={{ mt: 2 }}>
                                      Special Shifts ({jobData.specialShifts.length})
                                    </Typography>
                                    <Table size="small">
                                      <TableHead>
                                        <TableRow>
                                          <TableCell padding="checkbox"></TableCell>
                                          <TableCell>Type</TableCell>
                                          <TableCell>Hours</TableCell>
                                          <TableCell align="center">Actions</TableCell>
                                        </TableRow>
                                      </TableHead>
                                      <TableBody>
                                        {jobData.specialShifts.map((shift) => (
                                          <TableRow key={getSpecialShiftKey(shift)}>
                                            <TableCell padding="checkbox">
                                              <Checkbox
                                                checked={selectedSpecialShifts.has(getSpecialShiftKey(shift))}
                                                onChange={(e) => {
                                                  const newSelected = new Set(selectedSpecialShifts);
                                                  if (e.target.checked) {
                                                    newSelected.add(getSpecialShiftKey(shift));
                                                  } else {
                                                    newSelected.delete(getSpecialShiftKey(shift));
                                                  }
                                                  setSelectedSpecialShifts(newSelected);
                                                }}
                                                size="small"
                                              />
                                            </TableCell>
                                            <TableCell>{shift.specialShift.name}</TableCell>
                                            <TableCell>
                                              <Chip
                                                label={`${shift.hours}h`}
                                                size="small"
                                                variant="outlined"
                                                color="warning"
                                              />
                                            </TableCell>
                                            <TableCell align="center">
                                              <Tooltip title="Approve">
                                                <IconButton 
                                                  size="small" 
                                                  color="success"
                                                  onClick={() => {
                                                    // Seleccionar solo este special shift
                                                    setSelectedShifts(new Set());
                                                    setSelectedSpecialShifts(new Set([getSpecialShiftKey(shift)]));
                                                    setSelectedJobs(new Set());
                                                    // Abrir diálogo de confirmación
                                                    setConfirmDialog({
                                                      open: true,
                                                      action: 'approve',
                                                      totalShifts: 1,
                                                      jobName: `${shift.specialShift.name} (${jobData.job.name})`
                                                    });
                                                  }}
                                                >
                                                  <ApproveIcon fontSize="small" />
                                                </IconButton>
                                              </Tooltip>
                                              <Tooltip title="Reject">
                                                <IconButton 
                                                  size="small" 
                                                  color="error"
                                                  onClick={() => {
                                                    // Seleccionar solo este special shift
                                                    setSelectedShifts(new Set());
                                                    setSelectedSpecialShifts(new Set([getSpecialShiftKey(shift)]));
                                                    setSelectedJobs(new Set());
                                                    // Abrir diálogo de confirmación
                                                    setConfirmDialog({
                                                      open: true,
                                                      action: 'reject',
                                                      totalShifts: 1,
                                                      jobName: `${shift.specialShift.name} (${jobData.job.name})`
                                                    });
                                                  }}
                                                >
                                                  <RejectIcon fontSize="small" />
                                                </IconButton>
                                              </Tooltip>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </>
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
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={pendingJobs.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(e, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              labelDisplayedRows={({ from, to, count }) => 
                `${from}-${to} of ${count} jobs (${totalShifts} total shifts)`
              }
            />
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && pendingJobs.length === 0 && (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="h6" color="textSecondary">
              No pending shifts found
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              All shifts have been approved or there are no shifts to review.
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onClose={closeConfirmDialog}>
        <DialogTitle>
          {confirmDialog.action === 'approve' ? 'Approve Shifts' : 'Reject Shifts'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to {confirmDialog.action} {confirmDialog.totalShifts} shift(s)
            {confirmDialog.jobName ? ` for "${confirmDialog.jobName}"` : ''}?
            {confirmDialog.action === 'reject' && ' This action cannot be undone.'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeConfirmDialog} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            onClick={executeAction}
            color={confirmDialog.action === 'approve' ? 'success' : 'error'}
            variant="contained"
            disabled={actionLoading}
          >
            {actionLoading ? 'Processing...' : 
             (confirmDialog.action === 'approve' ? 'Approve' : 'Reject')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ShiftApproval;