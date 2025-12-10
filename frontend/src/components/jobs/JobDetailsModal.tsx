import React, { useEffect, useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, CircularProgress, Typography, Box, Table, TableBody, TableCell, TableRow, Paper, Chip, Tabs, Tab, TableContainer, TableHead, Divider
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { getJobById } from '../../services/jobService';
import { getJobPerformance, type PerformanceData } from '../../services/jobService';
import type { JobDetails } from '../../interfaces';
import { generateOperationPost } from '../../services/systemService';
import TextField from '@mui/material/TextField';
import { useNavigate } from 'react-router-dom';
import estimateService, { type Estimate } from '../../services/estimateService';

interface JobDetailsModalProps {
    jobId: number | null;
    open: boolean;
    onClose: () => void;
}

const JobDetailsModal: React.FC<JobDetailsModalProps> = ({ jobId, open, onClose }) => {
    const navigate = useNavigate();
    const [job, setJob] = useState<JobDetails | null>(null);
    const [performance, setPerformance] = useState<PerformanceData | null>(null);
    const [estimate, setEstimate] = useState<Estimate | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [loadingEstimate, setLoadingEstimate] = useState<boolean>(false);
    const [tab, setTab] = useState(0);
    const [generating, setGenerating] = useState(false);
    const [generatedPost, setGeneratedPost] = useState<string | null>(null);
    const [notes, setNotes] = useState<string>('');
    const MIN_SAVED_PERCENT = 0.15; // client rule; backend también valida
    
    const handleViewEstimate = () => {
        if (job?.estimate_id) {
            onClose();
            navigate(`/dashboard/estimates?estimateId=${job.estimate_id}`);
        }
    };
    
    const loadEstimateDetails = async () => {
        if (job?.estimate_id) {
            setLoadingEstimate(true);
            try {
                const estimateDetails = await estimateService.getEstimateDetails(job.estimate_id);
                setEstimate(estimateDetails);
            } catch (error) {
                console.error('Error loading estimate:', error);
            } finally {
                setLoadingEstimate(false);
            }
        }
    };

    useEffect(() => {
        if (jobId && open) {
            setLoading(true);
            // Reset states when opening a new job
            setEstimate(null);
            setGeneratedPost(null);
            setNotes('');
            setTab(0);
            
            Promise.all([
                getJobById(jobId),
                getJobPerformance(jobId)
            ]).then(([jobDetails, performanceData]) => {
                setJob(jobDetails);
                setPerformance(performanceData);
                
                // Si el job tiene un operation post guardado, mostrarlo
                if (jobDetails.operationPost?.post) {
                    setGeneratedPost(jobDetails.operationPost.post);
                }
            }).finally(() => {
                setLoading(false);
            });
        }
    }, [jobId, open]);
    
    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setTab(newValue);
        // Si se abre la tab de Estimate (tab 1), cargar detalles
        if (newValue === 1 && job?.estimate_id) {
            loadEstimateDetails();
        }
    };

    const renderPerformanceValue = (value: number, isPercent = false, isCurrency = false) => {
        const color = value < 0 ? 'error.main' : 'success.main';
        let formattedValue = isPercent ? `${(value * 100).toFixed(2)}%` : value.toFixed(2);
        if (isCurrency) {
            formattedValue = `$${formattedValue}`;
        }
        return <Typography sx={{ color, fontWeight: 'bold' }}>{formattedValue}</Typography>;
    };

    const regularHoursTotal = job?.shifts.reduce((acc, s) => acc + parseFloat(s.hours), 0) || 0;
    const specialHoursTotal = job?.jobSpecialShifts.reduce((acc, s) => acc + parseFloat(s.hours), 0) || 0;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ pb: 1 }}>Job Details</DialogTitle>
            <DialogContent sx={{ pt: 0 }}>
                {loading ? <CircularProgress /> : (
                    job && (
                        <>
                            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                                <Tabs value={tab} onChange={handleTabChange}>
                                    <Tab label="Details" />
                                    <Tab label="Estimate" disabled={!job.estimate_id} />
                                    <Tab label="Performance Summary" />
                                    <Tab label="Operation Command" />
                                </Tabs>
                            </Box>

                            {tab === 0 && (
                                // Details Tab Content
                                <Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                                        <Box>
                                            <Typography variant="h6">{job.name}</Typography>
                                            <Typography variant="body2" color="textSecondary">{job.branch?.name} Branch</Typography>
                                        </Box>
                                        <Box sx={{ textAlign: { sm: 'right' } }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: { sm: 'flex-end' } }}>
                                                <Typography variant="subtitle1"><strong>Estimator:</strong> {job.estimate?.salesperson?.name || 'N/A'}</Typography>
                                                {job.estimate_id && (
                                                    <Button 
                                                        size="small" 
                                                        onClick={handleViewEstimate}
                                                        endIcon={<OpenInNewIcon />}
                                                        sx={{ minWidth: 'auto', textTransform: 'none' }}
                                                    >
                                                        View
                                                    </Button>
                                                )}
                                            </Box>
                                            <Typography variant="subtitle1"><strong>Crew Leader:</strong> {job.crewLeader?.name || 'N/A'}</Typography>
                                            <Typography variant="body2" color="textSecondary">
                                                Completed on: {job.closing_date ? new Date(job.closing_date).toLocaleDateString() : 'N/A'}
                                            </Typography>
                                        </Box>
                                    </Box>

                                    <Box sx={{ mt: 2 }}>
                                        <Typography variant="h6" gutterBottom>Regular Shifts</Typography>
                                        <TableContainer component={Paper} sx={{ mb: 1 }}>
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell>Crew Member</TableCell>
                                                        <TableCell align="right">Hours Worked</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {job.shifts.map((shift, index) => (
                                                        <TableRow key={index}>
                                                            <TableCell>{shift.crewMember.name}</TableCell>
                                                            <TableCell align="right">{parseFloat(shift.hours).toFixed(2)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                        <Typography align="right" variant="body2" sx={{ fontWeight: 'bold' }}>
                                            Total Regular Hours: {regularHoursTotal.toFixed(2)}
                                        </Typography>

                                        {job.jobSpecialShifts.length > 0 && (
                                            <>
                                                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>Special Shifts</Typography>
                                                <TableContainer component={Paper} sx={{ mb: 1 }}>
                                                    <Table size="small">
                                                        <TableHead>
                                                            <TableRow>
                                                                <TableCell>Shift Type</TableCell>
                                                                <TableCell align="right">Hours</TableCell>
                                                            </TableRow>
                                                        </TableHead>
                                                        <TableBody>
                                                            {job.jobSpecialShifts.map((shift, index) => (
                                                                <TableRow key={index}>
                                                                    <TableCell>{shift.specialShift.name}</TableCell>
                                                                    <TableCell align="right">{parseFloat(shift.hours).toFixed(2)}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </TableContainer>
                                                <Typography align="right" variant="body2" sx={{ fontWeight: 'bold' }}>
                                                    Total Special Hours: {specialHoursTotal.toFixed(2)}
                                                </Typography>
                                            </>
                                        )}
                                    </Box>
                                </Box>
                            )}
                            
                            {tab === 1 && (
                                // Estimate Tab Content
                                <Box>
                                    {loadingEstimate ? (
                                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                            <CircularProgress />
                                        </Box>
                                    ) : estimate ? (
                                        <Box>
                                            <Typography variant="h6" gutterBottom>Estimate Details</Typography>
                                            <TableContainer component={Paper}>
                                                <Table size="small">
                                                    <TableBody>
                                                        <TableRow>
                                                            <TableCell><strong>Estimate Name:</strong></TableCell>
                                                            <TableCell>{estimate.name}</TableCell>
                                                        </TableRow>
                                                        <TableRow>
                                                            <TableCell><strong>Customer:</strong></TableCell>
                                                            <TableCell>{estimate.customer_name}</TableCell>
                                                        </TableRow>
                                                        <TableRow>
                                                            <TableCell><strong>Status:</strong></TableCell>
                                                            <TableCell>
                                                                <Chip label={estimate.EstimateStatus?.name || 'N/A'} size="small" />
                                                            </TableCell>
                                                        </TableRow>
                                                        <TableRow>
                                                            <TableCell><strong>Branch:</strong></TableCell>
                                                            <TableCell>{estimate.Branch?.name || 'N/A'}</TableCell>
                                                        </TableRow>
                                                        <TableRow>
                                                            <TableCell><strong>Salesperson:</strong></TableCell>
                                                            <TableCell>{estimate.SalesPerson?.name || 'N/A'}</TableCell>
                                                        </TableRow>
                                                        {estimate.customer_address && (
                                                            <TableRow>
                                                                <TableCell><strong>Address:</strong></TableCell>
                                                                <TableCell>{estimate.customer_address}</TableCell>
                                                            </TableRow>
                                                        )}
                                                        {estimate.customer_phone && (
                                                            <TableRow>
                                                                <TableCell><strong>Phone:</strong></TableCell>
                                                                <TableCell>{estimate.customer_phone}</TableCell>
                                                            </TableRow>
                                                        )}
                                                        {estimate.customer_email && (
                                                            <TableRow>
                                                                <TableCell><strong>Email:</strong></TableCell>
                                                                <TableCell>{estimate.customer_email}</TableCell>
                                                            </TableRow>
                                                        )}
                                                        {estimate.attic_tech_hours && (
                                                            <TableRow>
                                                                <TableCell><strong>Attic Tech Hours:</strong></TableCell>
                                                                <TableCell>{estimate.attic_tech_hours}</TableCell>
                                                            </TableRow>
                                                        )}
                                                        {estimate.price && (
                                                            <TableRow>
                                                                <TableCell><strong>Price:</strong></TableCell>
                                                                <TableCell>${parseFloat(estimate.price.toString()).toLocaleString()}</TableCell>
                                                            </TableRow>
                                                        )}
                                                        {estimate.final_price && (
                                                            <TableRow>
                                                                <TableCell><strong>Final Price:</strong></TableCell>
                                                                <TableCell>${parseFloat(estimate.final_price.toString()).toLocaleString()}</TableCell>
                                                            </TableRow>
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </TableContainer>
                                            {estimate.crew_notes && (
                                                <Box sx={{ mt: 2 }}>
                                                    <Typography variant="subtitle2" gutterBottom>Crew Notes:</Typography>
                                                    <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
                                                        <Typography variant="body2">{estimate.crew_notes}</Typography>
                                                    </Paper>
                                                </Box>
                                            )}
                                            {estimate.attic_tech_estimate_id && (
                                                <Box sx={{ mt: 2 }}>
                                                    <Button
                                                        variant="outlined"
                                                        color="primary"
                                                        startIcon={<span>🔗</span>}
                                                        onClick={() => {
                                                            window.open(`https://www.attic-tech.com/calculator?jobId=${estimate.attic_tech_estimate_id}`, '_blank');
                                                        }}
                                                    >
                                                        Open in Attic Tech
                                                    </Button>
                                                </Box>
                                            )}
                                        </Box>
                                    ) : (
                                        <Typography>No estimate data available</Typography>
                                    )}
                                </Box>
                            )}

                            {tab === 2 && performance && (
                                // Performance Summary Tab Content
                                <TableContainer component={Paper}>
                                    <Table>
                                        <TableBody>
                                            <TableRow>
                                                <TableCell>AT Estimated Hours</TableCell>
                                                <TableCell>{performance.atHours.toFixed(2)}</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell>CL Plan Hours</TableCell>
                                                <TableCell>{performance.clPlanHours.toFixed(2)}</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell>Total Worked Hours</TableCell>
                                                <TableCell>{performance.totalWorkedHours.toFixed(2)}</TableCell>
                                            </TableRow>
                                             <TableRow>
                                                <TableCell sx={{ fontWeight: 'bold' }}>Total Saved Hours</TableCell>
                                                <TableCell>{renderPerformanceValue(performance.totalSavedHours)}</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 'bold' }}>% Planned to Save</TableCell>
                                                <TableCell>{renderPerformanceValue(performance.plannedToSavePercent, true)}</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 'bold' }}>Potential Bonus Pool</TableCell>
                                                <TableCell>{renderPerformanceValue(performance.potentialBonusPool, false, true)}</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 'bold' }}>% Actual Saved</TableCell>
                                                <TableCell>{renderPerformanceValue(performance.actualSavedPercent, true)}</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 'bold' }}>Job Bonus Pool</TableCell>
                                                <TableCell>{renderPerformanceValue(performance.jobBonusPool, false, true)}</TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}

                            {tab === 3 && (
                                <Box>
                                    {!performance ? (
                                        <CircularProgress />
                                    ) : (
                                        <>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 2, flexWrap: 'wrap' }}>
                                                <Typography variant="body2" color="text.secondary">
                                                    To post: minimum 15% Actual Saved. Current: {(performance.actualSavedPercent * 100).toFixed(2)}%
                                                </Typography>
                                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                                    <Chip label={`Branch: ${job?.branch?.name || 'N/A'}`} size="small" />
                                                    <Chip label={`Crew Leader: ${job?.crewLeader?.name || 'N/A'}`} size="small" />
                                                    <Chip label={`Actual: ${(performance.actualSavedPercent * 100).toFixed(2)}%`} color={performance.actualSavedPercent >= MIN_SAVED_PERCENT ? 'success' : 'default'} size="small" />
                                                </Box>
                                            </Box>
                                            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                                                <TextField
                                                    label="Special request (optional)"
                                                    placeholder="e.g., emphasize speed, mention 2 Day Banger"
                                                    size="small"
                                                    fullWidth
                                                    value={notes}
                                                    onChange={(e) => setNotes(e.target.value)}
                                                />
                                                <Button
                                                    variant="contained"
                                                    color="secondary"
                                                    disabled={generating || performance.actualSavedPercent < MIN_SAVED_PERCENT}
                                                    onClick={async () => {
                                                        if (!jobId) return;
                                                        try {
                                                            setGenerating(true);
                                                            const resp = await generateOperationPost(jobId, notes);
                                                            if (!resp.eligible) {
                                                                setGeneratedPost('This job does not meet the minimum % to post.');
                                                            } else {
                                                                setGeneratedPost(resp.post || '');
                                                            }
                                                        } catch (e) {
                                                            setGeneratedPost('The post could not be generated automatically.');
                                                        } finally {
                                                            setGenerating(false);
                                                        }
                                                    }}
                                                >
                                                    {generating ? 'Generating…' : 'Generate Operation Post'}
                                                </Button>
                                                <Button
                                                    variant="outlined"
                                                    disabled={generating || performance.actualSavedPercent < MIN_SAVED_PERCENT}
                                                    onClick={async () => {
                                                        if (!jobId) return;
                                                        try {
                                                            setGenerating(true);
                                                            const resp = await generateOperationPost(jobId, notes);
                                                            if (!resp.eligible) {
                                                                setGeneratedPost('This job does not meet the minimum % to post.');
                                                            } else {
                                                                setGeneratedPost(resp.post || '');
                                                            }
                                                        } catch (e) {
                                                            setGeneratedPost('The post could not be generated automatically.');
                                                        } finally {
                                                            setGenerating(false);
                                                        }
                                                    }}
                                                >
                                                    Regenerate
                                                </Button>
                                                <Button
                                                    variant="outlined"
                                                    disabled={!generatedPost}
                                                    onClick={() => navigator.clipboard.writeText(generatedPost || '')}
                                                >
                                                    Copy Post
                                                </Button>
                                            </Box>
                                            {generatedPost && (
                                                <>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                                        <Typography variant="subtitle2">Post preview</Typography>
                                                        {job?.operationPost && (
                                                            <Chip 
                                                                label="Saved Post" 
                                                                size="small" 
                                                                color="success" 
                                                                variant="outlined"
                                                            />
                                                        )}
                                                    </Box>
                                                    <Paper variant="outlined" sx={{ p: 2, whiteSpace: 'pre-wrap', fontFamily: 'inherit', bgcolor: 'background.default' }}>
                                                        {generatedPost}
                                                    </Paper>
                                                </>
                                            )}
                                        </>
                                    )}
                                </Box>
                            )}
                        </>
                    )
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
};

export default JobDetailsModal; 