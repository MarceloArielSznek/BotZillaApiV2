import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { api } from '../config/api';

interface ShiftData {
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

interface DailyShiftUploadResponse {
  success: boolean;
  message: string;
  data: {
    jobs: Record<string, ShiftData[]>;
    shifts: ShiftData[];
    stats: {
      totalShifts: number;
      uniqueJobs: number;
      totalCrewMembers: number;
    };
  };
}

const DailyShiftUpload: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [shiftData, setShiftData] = useState<DailyShiftUploadResponse['data'] | null>(null);
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setShiftData(null); // Limpiar datos anteriores
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      enqueueSnackbar('Please select a file first', { variant: 'warning' });
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await api.post<DailyShiftUploadResponse>('/daily-shift-upload/parse', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        setShiftData(response.data.data);
        enqueueSnackbar('Excel processed successfully', { variant: 'success' });
      } else {
        throw new Error(response.data.message || 'Failed to process Excel');
      }
    } catch (error: any) {
      console.error('Error uploading file:', error);
      enqueueSnackbar(
        error.response?.data?.message || error.message || 'Failed to process Excel file',
        { variant: 'error' }
      );
    } finally {
      setUploading(false);
    }
  };

  const toggleJobExpanded = (jobName: string) => {
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

  if (!shiftData) {
    return (
      <Box sx={{ p: 3 }}>
        <Card>
          <CardContent>
            <Typography variant="h5" gutterBottom>
              Daily Shift Upload
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Upload a Builder Trend Excel file to view shifts grouped by job and crew member.
            </Typography>

            <Stack spacing={2}>
              <Button
                variant="outlined"
                component="label"
                startIcon={<UploadIcon />}
                fullWidth
              >
                Select Excel File
                <input
                  type="file"
                  hidden
                  accept=".xlsx,.xls,.xlsm"
                  onChange={handleFileChange}
                />
              </Button>

              {selectedFile && (
                <Alert severity="info">
                  Selected: <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024).toFixed(2)} KB)
                </Alert>
              )}

              <Button
                variant="contained"
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                startIcon={uploading ? <CircularProgress size={20} /> : <UploadIcon />}
                fullWidth
              >
                {uploading ? 'Processing...' : 'Process Excel'}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    );
  }

  // Agrupar shifts por job
  const jobsGrouped = shiftData.jobs;

  return (
    <Box sx={{ p: 3 }}>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h5">
              Daily Shift Upload
            </Typography>
            <Button
              variant="outlined"
              onClick={() => {
                setShiftData(null);
                setSelectedFile(null);
                setExpandedJobs(new Set());
              }}
            >
              Upload New File
            </Button>
          </Stack>

          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <Chip label={`${shiftData.stats.uniqueJobs} Jobs`} color="primary" />
            <Chip label={`${shiftData.stats.totalCrewMembers} Crew Members`} />
            <Chip label={`${shiftData.stats.totalShifts} Total Shifts`} />
          </Stack>
        </CardContent>
      </Card>

      <Stack spacing={2}>
        {Object.entries(jobsGrouped).map(([jobName, jobShifts]) => {
          const isExpanded = expandedJobs.has(jobName);

          const jobTotals = jobShifts.reduce(
            (totals, shift) => ({
              shifts: totals.shifts + shift.shifts_count,
              regular: totals.regular + shift.regular_hours,
              ot: totals.ot + shift.ot_hours,
              ot2: totals.ot2 + shift.ot2_hours,
              total: totals.total + shift.total_hours,
              crewMembers: totals.crewMembers + 1,
              hasQC: totals.hasQC || shift.has_qc
            }),
            { shifts: 0, regular: 0, ot: 0, ot2: 0, total: 0, crewMembers: 0, hasQC: false }
          );

          return (
            <Paper key={jobName} variant="outlined">
              {/* Header del Job */}
              <Box
                sx={{
                  p: 2,
                  bgcolor: 'primary.50',
                  cursor: 'pointer'
                }}
                onClick={() => toggleJobExpanded(jobName)}
              >
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ flex: 1 }}>
                    {jobName}
                  </Typography>
                  <Chip label={`${jobTotals.crewMembers} crew`} size="small" />
                  <Chip label={`${jobTotals.shifts} shifts`} size="small" />
                  <Chip
                    label={`${jobTotals.total.toFixed(2)} hrs total`}
                    color="primary"
                    size="small"
                  />
                  {jobTotals.hasQC && <Chip label="QC" color="warning" size="small" />}
                  <IconButton size="small">
                    {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Stack>
              </Box>

              {/* Detalle por Crew Member */}
              {isExpanded && (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'primary.main' }}>
                        <TableCell sx={{ fontWeight: 600, color: 'white' }}>Crew Member</TableCell>
                        <TableCell sx={{ fontWeight: 600, color: 'white' }} align="right">Shifts</TableCell>
                        <TableCell sx={{ fontWeight: 600, color: 'white' }} align="right">Regular</TableCell>
                        <TableCell sx={{ fontWeight: 600, color: 'white' }} align="right">OT</TableCell>
                        <TableCell sx={{ fontWeight: 600, color: 'white' }} align="right">2OT</TableCell>
                        <TableCell sx={{ fontWeight: 600, color: 'white' }} align="right">Total Hours</TableCell>
                        <TableCell sx={{ fontWeight: 600, color: 'white' }}>Tags</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {jobShifts.map((shift, shiftIndex) => {
                        const isQC = shift.has_qc || shift.crew_member_name === 'QC Special Shift';
                        const isDeliveryDrop = shift.crew_member_name === 'Job Delivery Special Shift';
                        const isSpecialShift = isQC || isDeliveryDrop;

                        let displayName = shift.crew_member_name;
                        if (isQC) displayName = 'QC';
                        if (isDeliveryDrop) displayName = 'Job Delivery';

                        return (
                          <TableRow key={shiftIndex} hover>
                            <TableCell>
                              {displayName}
                              {isSpecialShift && (
                                <Chip
                                  label="Special Shift"
                                  size="small"
                                  color="warning"
                                  sx={{ ml: 1, fontSize: '0.65rem' }}
                                />
                              )}
                            </TableCell>
                            <TableCell align="right">{shift.shifts_count}</TableCell>
                            <TableCell align="right">{shift.regular_hours.toFixed(2)}</TableCell>
                            <TableCell align="right">{shift.ot_hours.toFixed(2)}</TableCell>
                            <TableCell align="right">{shift.ot2_hours.toFixed(2)}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>
                              {shift.total_hours.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              {shift.tags ? (
                                <Chip label={shift.tags} size="small" variant="outlined" />
                              ) : (
                                <Typography variant="body2" color="text.secondary">
                                  —
                                </Typography>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {/* Totals Row */}
                      <TableRow sx={{ bgcolor: 'grey.100', fontWeight: 600 }}>
                        <TableCell sx={{ fontWeight: 600 }}>Total</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {jobTotals.shifts}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {jobTotals.regular.toFixed(2)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {jobTotals.ot.toFixed(2)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {jobTotals.ot2.toFixed(2)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, color: 'primary.main' }}>
                          {jobTotals.total.toFixed(2)}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          );
        })}
      </Stack>
    </Box>
  );
};

export default DailyShiftUpload;

