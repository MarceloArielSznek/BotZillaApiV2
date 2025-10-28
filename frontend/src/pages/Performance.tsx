import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  AlertTitle,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  TextField,
  Autocomplete,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import {
  CloudSync as SyncIcon,
  CheckCircle as SuccessIcon,
  ErrorOutline as ErrorIcon,
  CloudUpload as UploadIcon,
  Close as CloseIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  Publish as PublishIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import performanceService, { Branch } from '../services/performanceService';
import employeeService from '../services/employeeService';
import { v4 as uuidv4 } from 'uuid';

interface SyncJob {
  id: number;
  job_name: string;
  job_status: string;
  crew_leader: string;
  estimator: string;
  at_estimated_hours: number;
  cl_estimated_hours: number;
}

interface ExcelJob {
  job_name_excel: string;
  shifts_count: number;
  total_hours: number;
  crew_members: number;
  suggested_match_id: number | null;
  suggested_match_name: string | null;
  similarity_score: number;
}

interface AggregatedShift {
  job_id: number;
  job_name: string;
  crew_member_name: string;
  shifts_count: number;
  regular_hours: number;
  ot_hours: number;
  ot2_hours: number;
  total_hours: number;
  has_qc: boolean;
  tags: string;
}

const Performance: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  
  // Estados principales
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<number | ''>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('Uploading Shifts');
  const [loading, setLoading] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');
  const [currentSyncId, setCurrentSyncId] = useState<string>('');
  const [syncJobs, setSyncJobs] = useState<SyncJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  
  // Estados para fechas
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  
  // Estados para Excel upload y matching
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [excelJobs, setExcelJobs] = useState<ExcelJob[]>([]);
  const [spreadsheetJobs, setSpreadsheetJobs] = useState<SyncJob[]>([]);
  const [matchModalOpen, setMatchModalOpen] = useState(false);
  const [jobMatches, setJobMatches] = useState<Map<string, string | null>>(new Map());
  const [confirmingMatches, setConfirmingMatches] = useState(false);
  
  // Estados para tabla final
  const [aggregatedShifts, setAggregatedShifts] = useState<AggregatedShift[]>([]);
  const [loadingAggregated, setLoadingAggregated] = useState(false);
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  const [sendingToSpreadsheet, setSendingToSpreadsheet] = useState(false);
  const [selectedJobsForSpreadsheet, setSelectedJobsForSpreadsheet] = useState<Set<string>>(new Set());
  const [savingPermanently, setSavingPermanently] = useState(false);
  const [savingForApproval, setSavingForApproval] = useState(false);
  
  // Estados para edición de shifts
  const [editingShift, setEditingShift] = useState<{jobName: string, index: number} | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<AggregatedShift>>({});
  const [addShiftModalOpen, setAddShiftModalOpen] = useState(false);
  const [selectedJobForAdd, setSelectedJobForAdd] = useState<string>('');
  const [newShiftData, setNewShiftData] = useState<Partial<AggregatedShift>>({
    crew_member_name: '',
    shifts_count: 1,
    regular_hours: 0,
    ot_hours: 0,
    ot2_hours: 0,
    has_qc: false,
    tags: ''
  });
  
  // Estados para agregar QC shift
  const [addQCShiftModalOpen, setAddQCShiftModalOpen] = useState(false);
  const [selectedJobForQC, setSelectedJobForQC] = useState<string>('');
  const [qcShiftHours, setQcShiftHours] = useState<number>(3);
  
  // Estados para employees (crew members)
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // Statuses disponibles
  const availableStatuses = ['Closed Job', 'Uploading Shifts', 'Missing Data to Close', 'In Payload'];

  // Cargar branches y employees al montar el componente
  useEffect(() => {
    loadBranches();
    loadEmployees();
  }, []);

  const loadBranches = async () => {
    try {
      setLoadingBranches(true);
      const data = await performanceService.getBranches();
      // Validación defensiva de la respuesta
      if (data && Array.isArray(data)) {
        setBranches(data);
        // No mostrar warning si no hay branches, es un estado válido
      } else {
        console.warn('Invalid branches data:', data);
        setBranches([]);
        enqueueSnackbar('Invalid branches data received', { variant: 'error' });
      }
    } catch (error: any) {
      enqueueSnackbar('Failed to load branches: ' + (error.response?.data?.message || error.message), { variant: 'error' });
      console.error('Error loading branches:', error);
      setBranches([]); // Asegurar que branches sea un array vacío en caso de error
    } finally {
      setLoadingBranches(false);
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

  // Polling para obtener jobs de la base de datos después de disparar el webhook
  const pollForSpreadsheetJobs = async (syncId: string) => {
    const maxAttempts = 30; // 30 intentos = 30 segundos (1 intento por segundo)
    let attempts = 0;

    const poll = async () => {
      try {
        attempts++;
        console.log(`Polling attempt ${attempts}/${maxAttempts} for sync_id: ${syncId}`);

        const result = await performanceService.getSpreadsheetJobsFromCache(syncId);

        if (result.ready && result.data && result.data.jobs) {
          // Jobs recibidos!
          console.log('Jobs received from database:', result);
          const jobs = result.data.jobs;
          setSyncJobs(jobs);
          setSpreadsheetJobs(jobs);
          setSyncStatus('success');
          setSyncMessage(`${jobs.length} jobs loaded from spreadsheet`);
          enqueueSnackbar(`${jobs.length} jobs loaded successfully!`, { variant: 'success' });
          setLoading(false);
          return; // Detener polling
        }

        // Si no están listos y aún hay intentos, continuar polling
        if (attempts < maxAttempts) {
          setTimeout(poll, 1000); // Reintentar en 1 segundo
        } else {
          // Timeout
          setSyncStatus('error');
          setSyncMessage('Timeout waiting for jobs from spreadsheet');
          enqueueSnackbar('Timeout: Jobs did not arrive in time. Please try again.', { variant: 'error' });
          setLoading(false);
        }

      } catch (error: any) {
        console.error('Error polling for jobs:', error);
        
        // Si hay error y aún hay intentos, continuar polling
        if (attempts < maxAttempts) {
          setTimeout(poll, 1000);
        } else {
          setSyncStatus('error');
          setSyncMessage('Failed to retrieve jobs from spreadsheet');
          enqueueSnackbar('Failed to retrieve jobs. Please try again.', { variant: 'error' });
          setLoading(false);
        }
      }
    };

    // Iniciar polling
    poll();
  };

  // NUEVO PASO 1: Fetch jobs desde spreadsheet via Make.com
  const handleFetchJobsFromSpreadsheet = async () => {
    if (!selectedBranch) {
      enqueueSnackbar('Please select a branch first', { variant: 'warning' });
      return;
    }

    if (!fromDate || !toDate) {
      enqueueSnackbar('Please select both from and to dates', { variant: 'warning' });
      return;
    }

    try {
      setLoading(true);
      setSyncStatus('idle');
      setSyncMessage('');
      
      // Limpiar todo al hacer un nuevo sync
      setSyncJobs([]);
      setExcelJobs([]);
      setSpreadsheetJobs([]);
      setSelectedFile(null);
      setAggregatedShifts([]);
      setJobMatches(new Map());

      // Obtener el nombre del branch seleccionado
      const selectedBranchObj = branches.find(b => b.id === selectedBranch);
      if (!selectedBranchObj) {
        enqueueSnackbar('Branch not found', { variant: 'error' });
        return;
      }

      enqueueSnackbar('Triggering Make.com to fetch jobs from spreadsheet...', { variant: 'info' });

      // Disparar el webhook de Make.com
      const response = await performanceService.fetchJobsFromSpreadsheet(
        selectedBranchObj.name,
        fromDate,
        toDate
      );

      console.log('Webhook triggered:', response);

      // Guardar el sync_id para hacer polling
      const syncId = response.sync_id;
      setCurrentSyncId(syncId);

      // El webhook fue disparado, ahora hacemos polling para esperar los jobs
      setSyncStatus('idle');
      setSyncMessage('Webhook triggered. Waiting for jobs from spreadsheet...');
      enqueueSnackbar('Fetching jobs from spreadsheet... Please wait.', { 
        variant: 'info',
        autoHideDuration: 5000 
      });

      // Iniciar polling para obtener los jobs de la base de datos
      pollForSpreadsheetJobs(syncId);

    } catch (error: any) {
      setSyncStatus('error');
      setSyncMessage(error.message || 'Failed to fetch jobs from spreadsheet');
      enqueueSnackbar('Failed to fetch jobs: ' + error.message, { variant: 'error' });
      console.error('Error fetching jobs from spreadsheet:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerSync = async () => {
    if (!selectedBranch) {
      enqueueSnackbar('Please select a branch first', { variant: 'warning' });
      return;
    }

    if (!selectedStatus) {
      enqueueSnackbar('Please select a status', { variant: 'warning' });
      return;
    }

    try {
      setLoading(true);
      setSyncStatus('idle');
      setSyncMessage('');
      
      // Limpiar todo al hacer un nuevo sync
      setSyncJobs([]);
      setExcelJobs([]);
      setSpreadsheetJobs([]);
      setSelectedFile(null);
      setAggregatedShifts([]);
      setJobMatches(new Map());

      // Generar UUID único para este sync
      const syncId = uuidv4();
      console.log('Generated sync_id:', syncId);

      const response = await performanceService.triggerJobsSync(
        selectedBranch as number, 
        selectedStatus,
        syncId
      );

      if (response.success) {
        setSyncStatus('success');
        setSyncMessage(response.message);
        setCurrentSyncId(syncId);
        enqueueSnackbar('Jobs sync triggered successfully!', { variant: 'success' });
        
        // Esperar 3 segundos para que Make.com procese y envíe los jobs
        setTimeout(() => {
          fetchSyncJobs(syncId);
        }, 3000);
      } else {
        setSyncStatus('error');
        setSyncMessage(response.error || 'Unknown error occurred');
        enqueueSnackbar('Failed to trigger sync', { variant: 'error' });
      }
    } catch (error: any) {
      setSyncStatus('error');
      setSyncMessage(error.message || 'Failed to connect to server');
      enqueueSnackbar('Failed to trigger sync', { variant: 'error' });
      console.error('Error triggering sync:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSyncJobs = async (syncId: string) => {
    try {
      setLoadingJobs(true);
      const response = await performanceService.getSyncJobs(syncId);
      
      if (response.success) {
        setSyncJobs(response.data.jobs);
        enqueueSnackbar(`Loaded ${response.data.count} job(s) from spreadsheet`, { variant: 'info' });
      }
    } catch (error: any) {
      console.error('Error fetching sync jobs:', error);
      enqueueSnackbar('Failed to load sync jobs', { variant: 'error' });
    } finally {
      setLoadingJobs(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile || !currentSyncId) {
      enqueueSnackbar('Please select a file and ensure you have synced jobs first', { variant: 'warning' });
      return;
    }

    try {
      setUploadingFile(true);
      const response = await performanceService.uploadBuilderTrendExcel(selectedFile, currentSyncId);

      if (response.success) {
        const { excel_jobs, spreadsheet_jobs } = response.data;
        
        setExcelJobs(excel_jobs);
        setSpreadsheetJobs(spreadsheet_jobs);
        
        // Inicializar matches con las sugerencias del backend
        // Ahora la key es el nombre del spreadsheet (suggested_match_name)
        // Y el value es el nombre del Excel (job_name_excel)
        const initialMatches = new Map<string, string | null>();
        excel_jobs.forEach((job: ExcelJob) => {
          initialMatches.set(job.suggested_match_name, job.job_name_excel);
        });
        setJobMatches(initialMatches);
        
        const suggestedCount = excel_jobs.filter((j: ExcelJob) => j.job_name_excel !== null).length;
        enqueueSnackbar(
          `Found ${excel_jobs.length} job(s) in Spreadsheet. ${suggestedCount} match(es) found in Excel.`,
          { variant: 'info' }
        );
        
        // Abrir modal de confirmación
        setMatchModalOpen(true);
        
        // Limpiar el file input
        setSelectedFile(null);
      }
    } catch (error: any) {
      console.error('Error uploading file:', error);
      enqueueSnackbar(error.response?.data?.message || 'Failed to upload file', { variant: 'error' });
    } finally {
      setUploadingFile(false);
    }
  };

  const handleMatchChange = (spreadsheetJobName: string, matchedExcelJobName: string | null) => {
    const newMatches = new Map(jobMatches);
    newMatches.set(spreadsheetJobName, matchedExcelJobName);
    setJobMatches(newMatches);
  };

  const handleConfirmMatches = async () => {
    try {
      setConfirmingMatches(true);
      
      // Convertir Map a array para enviar al backend
      // Ahora: spreadsheet_job_name → matched_excel_job_name
      // Necesitamos: job_name_excel → matched_sync_job_id
      const matchesArray = Array.from(jobMatches.entries()).map(([spreadsheet_job_name, matched_excel_job_name]) => {
        // Buscar el sync_job_id del spreadsheet
        const syncJob = excelJobs.find(j => j.suggested_match_name === spreadsheet_job_name);
        
        return {
          job_name_excel: matched_excel_job_name, // Nombre del Excel (puede ser null)
          matched_sync_job_id: syncJob?.suggested_match_id || null // ID del spreadsheet job
        };
      });
      
      const response = await performanceService.confirmJobMatches(currentSyncId, matchesArray);
      
      if (response.success) {
        enqueueSnackbar('Job matches confirmed successfully!', { variant: 'success' });
        setMatchModalOpen(false);
        
        // Cargar tabla final con shifts agregados
        await fetchAggregatedShifts(currentSyncId);
      }
    } catch (error: any) {
      console.error('Error confirming matches:', error);
      enqueueSnackbar('Failed to confirm matches', { variant: 'error' });
    } finally {
      setConfirmingMatches(false);
    }
  };

  const fetchAggregatedShifts = async (syncId: string) => {
    try {
      setLoadingAggregated(true);
      const response = await performanceService.getAggregatedShifts(syncId);
      
      if (response.success) {
        const shifts = response.data.aggregated_shifts;
        
        // Agregar jobs del spreadsheet que no tienen shifts (sin match o < 80% similarity)
        // Para que aparezcan como tablas vacías donde se pueden agregar shifts manualmente
        const jobsWithShifts = new Set(shifts.map((s: AggregatedShift) => s.job_name));
        const jobsWithoutShifts = spreadsheetJobs
          .filter(job => !jobsWithShifts.has(job.job_name))
          .map(job => ({
            job_id: job.id,
            job_name: job.job_name,
            crew_member_name: '',
            shifts_count: 0,
            regular_hours: 0,
            ot_hours: 0,
            ot2_hours: 0,
            total_hours: 0,
            has_qc: false,
            tags: 'No match - Add shifts manually'
          }));
        
        // Combinar shifts existentes con placeholders para jobs sin match
        const allShifts = [...shifts, ...jobsWithoutShifts];
        
        setAggregatedShifts(allShifts);
        
        // Expandir el primer job por defecto
        if (allShifts.length > 0) {
          const firstJobName = allShifts[0].job_name;
          setExpandedJobs(new Set([firstJobName]));
        }
        
        enqueueSnackbar(
          `Loaded ${shifts.length} shifts. ${jobsWithoutShifts.length} jobs without match ready for manual entry.`, 
          { variant: 'success' }
        );
      }
    } catch (error: any) {
      console.error('Error fetching aggregated shifts:', error);
      enqueueSnackbar('Failed to load aggregated shifts', { variant: 'error' });
    } finally {
      setLoadingAggregated(false);
    }
  };

  // Funciones para editar shifts
  const handleStartEdit = (jobName: string, shiftIndex: number, shift: AggregatedShift) => {
    setEditingShift({ jobName, index: shiftIndex });
    setEditFormData({ ...shift });
  };

  const handleCancelEdit = () => {
    setEditingShift(null);
    setEditFormData({});
  };

  const handleSaveEdit = () => {
    if (!editingShift) return;

    setAggregatedShifts(prev => {
      return prev.map(shift => {
        if (shift.job_name === editingShift.jobName && 
            shift.crew_member_name === editFormData.crew_member_name) {
          return {
            ...shift,
            shifts_count: editFormData.shifts_count || shift.shifts_count,
            regular_hours: editFormData.regular_hours || shift.regular_hours,
            ot_hours: editFormData.ot_hours || shift.ot_hours,
            ot2_hours: editFormData.ot2_hours || shift.ot2_hours,
            total_hours: (editFormData.regular_hours || 0) + (editFormData.ot_hours || 0) + (editFormData.ot2_hours || 0),
            has_qc: editFormData.has_qc !== undefined ? editFormData.has_qc : shift.has_qc,
            tags: editFormData.tags !== undefined ? editFormData.tags : shift.tags
          };
        }
        return shift;
      });
    });

    setEditingShift(null);
    setEditFormData({});
    enqueueSnackbar('Shift updated successfully', { variant: 'success' });
  };

  const handleDeleteShift = (jobName: string, crewMemberName: string) => {
    if (!window.confirm(`Are you sure you want to delete the shift for ${crewMemberName}?`)) {
      return;
    }

    setAggregatedShifts(prev => 
      prev.filter(shift => 
        !(shift.job_name === jobName && shift.crew_member_name === crewMemberName)
      )
    );
    enqueueSnackbar('Shift deleted successfully', { variant: 'success' });
  };

  // Funciones para agregar shifts
  const handleOpenAddShift = (jobName: string) => {
    setSelectedJobForAdd(jobName);
    setNewShiftData({
      crew_member_name: '',
      shifts_count: 1,
      regular_hours: 0,
      ot_hours: 0,
      ot2_hours: 0,
      has_qc: false,
      tags: ''
    });
    setAddShiftModalOpen(true);
  };

  // Funciones para agregar QC shift
  const handleOpenAddQCShift = (jobName: string) => {
    setSelectedJobForQC(jobName);
    setQcShiftHours(3); // Default 3 hours
    setAddQCShiftModalOpen(true);
  };

  const handleAddQCShift = async () => {
    if (!selectedJobForQC || qcShiftHours <= 0) {
      enqueueSnackbar('Please enter valid hours for QC shift', { variant: 'warning' });
      return;
    }

    // Agregar QC shift a la lista de shifts agregados
    const newQCShift: AggregatedShift = {
      job_id: 0, // Temporal, se asignará al guardar
      job_name: selectedJobForQC,
      crew_member_name: 'QC Special Shift',
      shifts_count: 1,
      regular_hours: qcShiftHours,
      ot_hours: 0,
      ot2_hours: 0,
      total_hours: qcShiftHours,
      has_qc: true,
      tags: 'QC'
    };

    setAggregatedShifts(prev => [...prev, newQCShift]);
    setAddQCShiftModalOpen(false);
    enqueueSnackbar('QC shift added successfully', { variant: 'success' });
  };

  const handleAddShift = () => {
    if (!newShiftData.crew_member_name || !newShiftData.crew_member_name.trim()) {
      enqueueSnackbar('Crew member name is required', { variant: 'error' });
      return;
    }

    const totalHours = (newShiftData.regular_hours || 0) + 
                       (newShiftData.ot_hours || 0) + 
                       (newShiftData.ot2_hours || 0);

    const newShift: AggregatedShift = {
      job_id: 0, // Temporal, no se usa para display
      job_name: selectedJobForAdd,
      crew_member_name: newShiftData.crew_member_name!,
      shifts_count: newShiftData.shifts_count || 1,
      regular_hours: newShiftData.regular_hours || 0,
      ot_hours: newShiftData.ot_hours || 0,
      ot2_hours: newShiftData.ot2_hours || 0,
      total_hours: totalHours,
      has_qc: newShiftData.has_qc || false,
      tags: newShiftData.tags || ''
    };

    setAggregatedShifts(prev => [...prev, newShift]);
    setAddShiftModalOpen(false);
    enqueueSnackbar('Shift added successfully', { variant: 'success' });
  };

  const handleSendToSpreadsheet = async () => {
    if (!currentSyncId) {
      enqueueSnackbar('No sync ID available', { variant: 'warning' });
      return;
    }

    if (selectedJobsForSpreadsheet.size === 0) {
      enqueueSnackbar('Please select at least one job to send', { variant: 'warning' });
      return;
    }

    try {
      setSendingToSpreadsheet(true);
      
      // Enviar solo los jobs seleccionados
      const selectedJobNames = Array.from(selectedJobsForSpreadsheet);
      const response = await performanceService.sendShiftsToSpreadsheet(currentSyncId, selectedJobNames);

      if (response.success) {
        enqueueSnackbar(
          `Successfully sent ${response.data.jobs_count} job(s) to spreadsheet for writing`,
          { variant: 'success' }
        );
      }
    } catch (error: any) {
      console.error('Error sending to spreadsheet:', error);
      enqueueSnackbar(error.response?.data?.message || 'Failed to send data to spreadsheet', { variant: 'error' });
    } finally {
      setSendingToSpreadsheet(false);
    }
  };

  // Funciones para selección de jobs
  const handleToggleJobSelection = (jobName: string) => {
    setSelectedJobsForSpreadsheet(prev => {
      const newSet = new Set(prev);
      if (newSet.has(jobName)) {
        newSet.delete(jobName);
      } else {
        newSet.add(jobName);
      }
      return newSet;
    });
  };

  const handleSelectAllJobs = () => {
    const allJobNames = new Set(
      Object.keys(
        aggregatedShifts.reduce((acc, shift) => {
          acc[shift.job_name] = true;
          return acc;
        }, {} as Record<string, boolean>)
      )
    );
    setSelectedJobsForSpreadsheet(allJobNames);
  };

  const handleDeselectAllJobs = () => {
    setSelectedJobsForSpreadsheet(new Set());
  };

  const handleSaveForApproval = async () => {
    if (!currentSyncId) {
      enqueueSnackbar('No sync ID available', { variant: 'warning' });
      return;
    }

    if (selectedJobsForSpreadsheet.size === 0) {
      enqueueSnackbar('Please select at least one job to save', { variant: 'warning' });
      return;
    }

    if (!window.confirm(`Save ${selectedJobsForSpreadsheet.size} job(s) for approval? They will appear in the Performance Approval tab for review.`)) {
      return;
    }

    try {
      setSavingForApproval(true);
      const selectedJobNames = Array.from(selectedJobsForSpreadsheet);
      
      // Filtrar shifts de los jobs seleccionados
      const selectedShifts = aggregatedShifts.filter(shift => 
        selectedJobNames.includes(shift.job_name)
      );
      
      const response = await performanceService.savePerformanceDataPermanently(
        currentSyncId, 
        selectedJobNames, 
        false, // false = no auto-approve
        selectedShifts // Enviar los shifts actuales (con modificaciones del usuario)
      );

      if (response.success) {
        const data = response.data;
        enqueueSnackbar(
          `✅ ${data.jobs_created || 0} jobs saved for approval! Go to Performance Approval tab to review.`,
          { variant: 'success' }
        );
        
        // Limpiar jobs guardados de la lista
        const savedJobNames = Array.from(selectedJobsForSpreadsheet);
        setAggregatedShifts(prev => prev.filter(shift => !savedJobNames.includes(shift.job_name)));
        setSelectedJobsForSpreadsheet(new Set());
      }
    } catch (error: any) {
      console.error('Error saving for approval:', error);
      enqueueSnackbar(
        error.response?.data?.message || 'Failed to save data for approval',
        { variant: 'error' }
      );
    } finally {
      setSavingForApproval(false);
    }
  };

  const handleSavePermanently = async () => {
    if (!currentSyncId) {
      enqueueSnackbar('No sync ID available', { variant: 'warning' });
      return;
    }

    if (selectedJobsForSpreadsheet.size === 0) {
      enqueueSnackbar('Please select at least one job to save', { variant: 'warning' });
      return;
    }

    if (!window.confirm(`Save ${selectedJobsForSpreadsheet.size} job(s) permanently and approve immediately? They will appear in the Jobs List.`)) {
      return;
    }

    try {
      setSavingPermanently(true);
      const selectedJobNames = Array.from(selectedJobsForSpreadsheet);
      
      // Filtrar shifts de los jobs seleccionados
      const selectedShifts = aggregatedShifts.filter(shift => 
        selectedJobNames.includes(shift.job_name)
      );
      
      const response = await performanceService.savePerformanceDataPermanently(
        currentSyncId, 
        selectedJobNames, 
        true, // true = auto-approve
        selectedShifts // Enviar los shifts actuales (con modificaciones del usuario)
      );

      if (response.success) {
        const data = response.data;
        enqueueSnackbar(
          `✅ Data saved! ${data.jobs_created} jobs created, ${data.jobs_updated} updated, ${data.shifts_created} shifts created.`,
          { variant: 'success' }
        );
        
        // Limpiar jobs guardados de la lista
        const savedJobNames = Array.from(selectedJobsForSpreadsheet);
        setAggregatedShifts(prev => prev.filter(shift => !savedJobNames.includes(shift.job_name)));
        setSelectedJobsForSpreadsheet(new Set());
      }
    } catch (error: any) {
      console.error('Error saving permanently:', error);
      enqueueSnackbar(
        error.response?.data?.message || 'Failed to save data permanently',
        { variant: 'error' }
      );
    } finally {
      setSavingPermanently(false);
    }
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" paragraph>
        1. Select a branch to fetch yesterday's jobs from the Google Spreadsheet<br />
        2. Upload a BuilderTrend Excel file with shifts<br />
        3. Confirm job matches in the modal<br />
        4. Review the final aggregated shifts table and send to spreadsheet
      </Typography>

      <Divider sx={{ my: 3 }} />

      {/* NUEVO PASO 1: Fetch Jobs desde Spreadsheet via Make.com */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Step 1: Fetch Jobs from Spreadsheet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select a branch and date range to fetch jobs from the Google Spreadsheet via Make.com
          </Typography>

          <Stack spacing={2} sx={{ mt: 2 }}>
            <FormControl fullWidth disabled={loading || loadingBranches}>
              <InputLabel>Select Branch</InputLabel>
              <Select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value as number)}
                label="Select Branch"
              >
                <MenuItem value="">
                  <em>Select a branch</em>
                </MenuItem>
                {branches.map((branch) => (
                  <MenuItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="From Date"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                disabled={loading}
                fullWidth
                InputLabelProps={{
                  shrink: true,
                }}
              />
              <TextField
                label="To Date"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                disabled={loading}
                fullWidth
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Box>

            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SyncIcon />}
              onClick={handleFetchJobsFromSpreadsheet}
              disabled={loading || !selectedBranch || !fromDate || !toDate}
              fullWidth
            >
              {loading ? 'Fetching Jobs...' : 'Fetch Jobs from Spreadsheet'}
            </Button>
          </Stack>

          {/* ANTIGUO PASO 1 - COMENTADO/DESACTIVADO
          <Divider sx={{ my: 3 }} />
          <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            Old Method (Disabled): Sync via Performance Spreadsheet
          </Typography>
          <Stack spacing={2} sx={{ mt: 2, opacity: 0.5 }}>
            <FormControl fullWidth disabled>
              <InputLabel>Select Status</InputLabel>
              <Select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                label="Select Status"
                disabled
              >
                {availableStatuses.map((status) => (
                  <MenuItem key={status} value={status}>
                    {status}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              variant="outlined"
              startIcon={<SyncIcon />}
              onClick={handleTriggerSync}
              disabled
              fullWidth
            >
              Trigger Sync (Old Method - Disabled)
            </Button>
          </Stack>
          */}

          {syncStatus !== 'idle' && (
            <Alert 
              severity={syncStatus === 'success' ? 'success' : 'error'} 
              icon={syncStatus === 'success' ? <SuccessIcon /> : <ErrorIcon />}
              sx={{ mt: 2 }}
            >
              <AlertTitle>{syncStatus === 'success' ? 'Success' : 'Error'}</AlertTitle>
              {syncMessage}
            </Alert>
          )}
          
          {loadingJobs && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <CircularProgress size={24} />
              <Typography variant="body2" sx={{ ml: 2 }}>
                Loading jobs from spreadsheet...
              </Typography>
            </Box>
          )}

          {syncJobs.length > 0 && (
            <Paper sx={{ mt: 2, p: 2, bgcolor: 'success.50', border: '1px solid', borderColor: 'success.main' }}>
              <Typography variant="subtitle2" color="success.dark">
                ✓ {syncJobs.length} job(s) synced from spreadsheet
              </Typography>
            </Paper>
          )}
        </CardContent>
      </Card>

      {/* Paso 2: Upload Excel */}
      {syncJobs.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Step 2: Upload BuilderTrend Excel
            </Typography>

            <Stack spacing={2} sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                component="label"
                startIcon={<UploadIcon />}
                disabled={uploadingFile}
                fullWidth
              >
                {selectedFile ? selectedFile.name : 'Choose Excel File'}
                <input
                  type="file"
                  hidden
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                />
              </Button>

              <Button
                variant="contained"
                startIcon={uploadingFile ? <CircularProgress size={20} color="inherit" /> : <UploadIcon />}
                onClick={handleFileUpload}
                disabled={!selectedFile || uploadingFile}
                fullWidth
              >
                {uploadingFile ? 'Processing Excel...' : 'Upload & Process'}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Modal de Confirmación de Matches */}
      <Dialog 
        open={matchModalOpen} 
        onClose={() => !confirmingMatches && setMatchModalOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Confirm Job Matches</Typography>
            <IconButton 
              onClick={() => setMatchModalOpen(false)} 
              disabled={confirmingMatches}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>
            <AlertTitle>Confirm Job Matches</AlertTitle>
            Review the suggested matches below. Green rows indicate automatic suggestions based on name similarity.
            You can change any match using the dropdown or leave it as "No match" if appropriate.
          </Alert>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }}>Job Name (Spreadsheet)</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }}>Shifts</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }}>Total Hours</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }}>Crew Members</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }}>Match with Excel</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {excelJobs.map((excelJob, index) => (
                  <TableRow 
                    key={index}
                    sx={{
                      bgcolor: excelJob.suggested_match_id ? 'success.50' : 'transparent'
                    }}
                  >
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {excelJob.suggested_match_name}
                        </Typography>
                        {excelJob.job_name_excel && (
                          <Chip 
                            label={`${excelJob.similarity_score.toFixed(0)}% similar`} 
                            size="small" 
                            color="success"
                            sx={{ mt: 0.5 }}
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>{excelJob.shifts_count}</TableCell>
                    <TableCell>{excelJob.total_hours.toFixed(2)}</TableCell>
                    <TableCell>{excelJob.crew_members}</TableCell>
                    <TableCell>
                      <FormControl fullWidth size="small">
                        <Select
                          value={jobMatches.get(excelJob.suggested_match_name) || ''}
                          onChange={(e) => handleMatchChange(
                            excelJob.suggested_match_name,
                            (e.target.value as any) === '' ? null : e.target.value as string
                          )}
                          displayEmpty
                        >
                          <MenuItem value="">
                            <em>No match</em>
                          </MenuItem>
                          {/* Mostrar todos los jobs únicos del Excel */}
                          {Array.from(new Set(excelJobs.map(j => j.job_name_excel).filter(Boolean))).map((excelJobName) => (
                            <MenuItem key={excelJobName} value={excelJobName}>
                              {excelJobName}
                              {excelJobName === excelJob.job_name_excel && ' ✓ (Suggested)'}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        
        <DialogActions>
          <Button 
            onClick={() => setMatchModalOpen(false)} 
            disabled={confirmingMatches}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmMatches}
            disabled={confirmingMatches}
            startIcon={confirmingMatches ? <CircularProgress size={20} color="inherit" /> : null}
          >
            {confirmingMatches ? 'Confirming...' : 'Confirm Matches'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Tabla Final: Shifts Agregados */}
      {aggregatedShifts.length > 0 && (
        <Card>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Box>
                <Typography variant="h6">
                  Final Result: Aggregated Shifts by Job & Crew Member
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {selectedJobsForSpreadsheet.size} of {Object.keys(aggregatedShifts.reduce((acc, shift) => {
                    acc[shift.job_name] = true;
                    return acc;
                  }, {} as Record<string, boolean>)).length} jobs selected
                </Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleSelectAllJobs}
                >
                  Select All
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleDeselectAllJobs}
                >
                  Deselect All
                </Button>
                <Button
                  variant="contained"
                  color="warning"
                  startIcon={savingForApproval ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                  onClick={handleSaveForApproval}
                  disabled={savingForApproval || savingPermanently || selectedJobsForSpreadsheet.size === 0}
                >
                  {savingForApproval ? 'Saving...' : `Save ${selectedJobsForSpreadsheet.size} for Approval`}
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={savingPermanently ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                  onClick={handleSavePermanently}
                  disabled={savingPermanently || savingForApproval || selectedJobsForSpreadsheet.size === 0}
                >
                  {savingPermanently ? 'Saving...' : `Save ${selectedJobsForSpreadsheet.size} & Approve`}
                </Button>
              </Stack>
            </Box>

            {loadingAggregated ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Stack spacing={2} sx={{ mt: 2 }}>
                {/* Agrupar shifts por job */}
                {Object.entries(
                  aggregatedShifts.reduce((acc, shift) => {
                    if (!acc[shift.job_name]) {
                      acc[shift.job_name] = [];
                    }
                    acc[shift.job_name].push(shift);
                    return acc;
                  }, {} as Record<string, typeof aggregatedShifts>)
                ).map(([jobName, jobShifts]) => {
                  const isExpanded = expandedJobs.has(jobName);
                  
                  const toggleExpanded = () => {
                    setExpandedJobs(prev => {
                      const newSet = new Set(prev);
                      if (newSet.has(jobName)) {
                        newSet.delete(jobName);
                      } else {
                        newSet.add(jobName);
                      }
                      return newSet;
                    });
                  };
                  
                  const jobTotals = jobShifts.reduce((totals, shift) => ({
                    shifts: totals.shifts + shift.shifts_count,
                    regular: totals.regular + shift.regular_hours,
                    ot: totals.ot + shift.ot_hours,
                    ot2: totals.ot2 + shift.ot2_hours,
                    total: totals.total + shift.total_hours,
                    crewMembers: totals.crewMembers + 1,
                    hasQC: totals.hasQC || shift.has_qc
                  }), { shifts: 0, regular: 0, ot: 0, ot2: 0, total: 0, crewMembers: 0, hasQC: false });

                  return (
                    <Paper key={jobName} variant="outlined">
                      {/* Header del Job - Siempre visible */}
                      <Box
                        sx={{
                          p: 2,
                          bgcolor: 'primary.50'
                        }}
                      >
                        <Stack direction="row" alignItems="center" spacing={2}>
                          <Checkbox
                            checked={selectedJobsForSpreadsheet.has(jobName)}
                            onChange={() => handleToggleJobSelection(jobName)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Typography 
                            variant="subtitle1" 
                            fontWeight={600} 
                            sx={{ 
                              flex: 1,
                              cursor: 'pointer',
                              '&:hover': { textDecoration: 'underline' }
                            }}
                            onClick={toggleExpanded}
                          >
                            {jobName}
                          </Typography>
                          <Chip label={`${jobTotals.crewMembers} crew`} size="small" />
                          <Chip label={`${jobTotals.shifts} shifts`} size="small" />
                          <Chip 
                            label={`${jobTotals.total.toFixed(2)} hrs total`} 
                            color="primary" 
                            size="small" 
                          />
                          {jobTotals.hasQC && (
                            <Chip label="QC" color="warning" size="small" />
                          )}
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<AddIcon />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenAddShift(jobName);
                            }}
                          >
                            Add Shift
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="warning"
                            startIcon={<AddIcon />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenAddQCShift(jobName);
                            }}
                          >
                            Add QC Shift
                          </Button>
                          <IconButton size="small" onClick={toggleExpanded}>
                            {isExpanded ? '▲' : '▼'}
                          </IconButton>
                        </Stack>
                      </Box>

                      {/* Detalle por Crew Member - Colapsable */}
                      {isExpanded && (
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow sx={{ bgcolor: 'primary.main' }}>
                                <TableCell sx={{ fontWeight: 600, color: 'white' }}>Crew Member</TableCell>
                                <TableCell sx={{ fontWeight: 600, color: 'white' }}>Shifts</TableCell>
                                <TableCell sx={{ fontWeight: 600, color: 'white' }}>Regular</TableCell>
                                <TableCell sx={{ fontWeight: 600, color: 'white' }}>OT</TableCell>
                                <TableCell sx={{ fontWeight: 600, color: 'white' }}>2OT</TableCell>
                                <TableCell sx={{ fontWeight: 600, color: 'white' }}>Total Hours</TableCell>
                                <TableCell sx={{ fontWeight: 600, color: 'white' }}>QC</TableCell>
                                <TableCell sx={{ fontWeight: 600, color: 'white' }}>Tags</TableCell>
                                <TableCell sx={{ fontWeight: 600, color: 'white' }}>Actions</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {jobShifts.length === 0 || (jobShifts.length === 1 && !jobShifts[0].crew_member_name) ? (
                                <TableRow>
                                  <TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                    <Typography variant="body2">
                                      No shifts found for this job. Click "Add Shift" to add manually.
                                    </Typography>
                                  </TableCell>
                                </TableRow>
                              ) : (
                                jobShifts.map((shift, shiftIndex) => {
                                  const isEditing = editingShift?.jobName === jobName && editingShift?.index === shiftIndex;
                                  
                                  return (
                                    <TableRow key={shiftIndex} hover>
                                      <TableCell>{shift.crew_member_name}</TableCell>
                                    <TableCell>
                                      {isEditing ? (
                                        <TextField
                                          type="number"
                                          size="small"
                                          value={editFormData.shifts_count || 0}
                                          onChange={(e) => setEditFormData({...editFormData, shifts_count: Number(e.target.value)})}
                                          sx={{ width: 60 }}
                                        />
                                      ) : (
                                        shift.shifts_count
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {isEditing ? (
                                        <TextField
                                          type="number"
                                          size="small"
                                          value={editFormData.regular_hours || 0}
                                          onChange={(e) => setEditFormData({...editFormData, regular_hours: Number(e.target.value)})}
                                          sx={{ width: 80 }}
                                        />
                                      ) : (
                                        shift.regular_hours.toFixed(2)
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {isEditing ? (
                                        <TextField
                                          type="number"
                                          size="small"
                                          value={editFormData.ot_hours || 0}
                                          onChange={(e) => setEditFormData({...editFormData, ot_hours: Number(e.target.value)})}
                                          sx={{ width: 80 }}
                                        />
                                      ) : (
                                        shift.ot_hours.toFixed(2)
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {isEditing ? (
                                        <TextField
                                          type="number"
                                          size="small"
                                          value={editFormData.ot2_hours || 0}
                                          onChange={(e) => setEditFormData({...editFormData, ot2_hours: Number(e.target.value)})}
                                          sx={{ width: 80 }}
                                        />
                                      ) : (
                                        shift.ot2_hours.toFixed(2)
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <Chip 
                                        label={isEditing 
                                          ? ((editFormData.regular_hours || 0) + (editFormData.ot_hours || 0) + (editFormData.ot2_hours || 0)).toFixed(2)
                                          : shift.total_hours.toFixed(2)
                                        } 
                                        color="primary" 
                                        size="small" 
                                      />
                                    </TableCell>
                                    <TableCell>
                                      {shift.has_qc ? (
                                        <Chip label="QC" color="warning" size="small" />
                                      ) : (
                                        '-'
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {isEditing ? (
                                        <TextField
                                          size="small"
                                          value={editFormData.tags || ''}
                                          onChange={(e) => setEditFormData({...editFormData, tags: e.target.value})}
                                          sx={{ width: 100 }}
                                        />
                                      ) : (
                                        <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                                          {shift.tags || '-'}
                                        </Typography>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {isEditing ? (
                                        <Stack direction="row" spacing={0.5}>
                                          <IconButton size="small" color="primary" onClick={handleSaveEdit}>
                                            <SaveIcon fontSize="small" />
                                          </IconButton>
                                          <IconButton size="small" onClick={handleCancelEdit}>
                                            <CancelIcon fontSize="small" />
                                          </IconButton>
                                        </Stack>
                                      ) : (
                                        <Stack direction="row" spacing={0.5}>
                                          <IconButton 
                                            size="small" 
                                            color="primary"
                                            onClick={() => handleStartEdit(jobName, shiftIndex, shift)}
                                          >
                                            <EditIcon fontSize="small" />
                                          </IconButton>
                                          <IconButton 
                                            size="small" 
                                            color="error"
                                            onClick={() => handleDeleteShift(jobName, shift.crew_member_name)}
                                          >
                                            <DeleteIcon fontSize="small" />
                                          </IconButton>
                                        </Stack>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                              )}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      )}
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal para agregar shift manualmente */}
      <Dialog open={addShiftModalOpen} onClose={() => setAddShiftModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Add Shift Manually
          <IconButton
            onClick={() => setAddShiftModalOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Job Name"
              value={selectedJobForAdd}
              disabled
              fullWidth
            />
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
              label="Number of Shifts"
              type="number"
              value={newShiftData.shifts_count}
              onChange={(e) => setNewShiftData({...newShiftData, shifts_count: Number(e.target.value)})}
              fullWidth
              inputProps={{ min: 1 }}
            />
            <TextField
              label="Regular Hours"
              type="number"
              value={newShiftData.regular_hours}
              onChange={(e) => setNewShiftData({...newShiftData, regular_hours: Number(e.target.value)})}
              fullWidth
              inputProps={{ min: 0, step: 0.25 }}
            />
            <TextField
              label="OT Hours"
              type="number"
              value={newShiftData.ot_hours}
              onChange={(e) => setNewShiftData({...newShiftData, ot_hours: Number(e.target.value)})}
              fullWidth
              inputProps={{ min: 0, step: 0.25 }}
            />
            <TextField
              label="2OT Hours"
              type="number"
              value={newShiftData.ot2_hours}
              onChange={(e) => setNewShiftData({...newShiftData, ot2_hours: Number(e.target.value)})}
              fullWidth
              inputProps={{ min: 0, step: 0.25 }}
            />
            <TextField
              label="Tags (optional)"
              value={newShiftData.tags}
              onChange={(e) => setNewShiftData({...newShiftData, tags: e.target.value})}
              fullWidth
              multiline
              rows={2}
            />
            <Box>
              <Typography variant="body2" color="text.secondary">
                Total Hours: {((newShiftData.regular_hours || 0) + (newShiftData.ot_hours || 0) + (newShiftData.ot2_hours || 0)).toFixed(2)}
              </Typography>
            </Box>
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
      <Dialog open={addQCShiftModalOpen} onClose={() => setAddQCShiftModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          Add QC Shift
          <IconButton
            onClick={() => setAddQCShiftModalOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Job Name"
              value={selectedJobForQC}
              disabled
              fullWidth
            />
            <TextField
              label="QC Hours"
              type="number"
              value={qcShiftHours}
              onChange={(e) => setQcShiftHours(Number(e.target.value))}
              fullWidth
              required
              autoFocus
              inputProps={{ min: 0.25, step: 0.25 }}
              helperText="Enter the number of hours for this QC shift"
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

export default Performance;
