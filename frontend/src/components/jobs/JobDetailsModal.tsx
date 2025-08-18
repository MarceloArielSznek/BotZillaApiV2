import React, { useEffect, useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, CircularProgress, Typography, Box, Table, TableBody, TableCell, TableRow, Paper, Chip, Tabs, Tab, TableContainer, TableHead, Divider
} from '@mui/material';
import { getJobById } from '../../services/jobService';
import { getJobPerformance, type PerformanceData } from '../../services/jobService';
import type { JobDetails } from '../../interfaces';
import { generateOperationPost } from '../../services/systemService';
import TextField from '@mui/material/TextField';

interface JobDetailsModalProps {
    jobId: number | null;
    open: boolean;
    onClose: () => void;
}

const JobDetailsModal: React.FC<JobDetailsModalProps> = ({ jobId, open, onClose }) => {
    const [job, setJob] = useState<JobDetails | null>(null);
    const [performance, setPerformance] = useState<PerformanceData | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [tab, setTab] = useState(0);
    const [generating, setGenerating] = useState(false);
    const [generatedPost, setGeneratedPost] = useState<string | null>(null);
    const [notes, setNotes] = useState<string>('');
    const MIN_SAVED_PERCENT = 0.15; // client rule; backend también valida

    useEffect(() => {
        if (jobId && open) {
            setLoading(true);
            Promise.all([
                getJobById(jobId),
                getJobPerformance(jobId)
            ]).then(([jobDetails, performanceData]) => {
                setJob(jobDetails);
                setPerformance(performanceData);
            }).finally(() => {
                setLoading(false);
            });
        }
    }, [jobId, open]);
    
    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setTab(newValue);
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
                                            <Typography variant="subtitle1"><strong>Estimator:</strong> {job.estimate?.salesperson?.name || 'N/A'}</Typography>
                                            <Typography variant="subtitle1"><strong>Crew Leader:</strong> {job.crewLeader?.name || 'N/A'}</Typography>
                                            <Typography variant="body2" color="textSecondary">
                                                Completed on: {new Date(job.closing_date).toLocaleDateString()}
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
                            
                            {tab === 1 && performance && (
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

                            {tab === 2 && (
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
                                                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Post preview</Typography>
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