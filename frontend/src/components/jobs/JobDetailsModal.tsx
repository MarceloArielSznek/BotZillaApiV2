import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    CircularProgress,
    Alert,
    Box,
    Grid,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Divider
} from '@mui/material';
import { getJobById } from '../../services/jobService';
import type { JobDetails } from '../../interfaces';

interface JobDetailsModalProps {
    jobId: number | null;
    open: boolean;
    onClose: () => void;
}

const JobDetailsModal: React.FC<JobDetailsModalProps> = ({ jobId, open, onClose }) => {
    const [jobDetails, setJobDetails] = useState<JobDetails | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (jobId && open) {
            const fetchJobDetails = async () => {
                try {
                    setLoading(true);
                    setError(null);
                    const data = await getJobById(jobId);
                    setJobDetails(data);
                } catch (err) {
                    setError('Failed to fetch job details.');
                    console.error(err);
                } finally {
                    setLoading(false);
                }
            };
            fetchJobDetails();
        }
    }, [jobId, open]);

    const handleClose = () => {
        onClose();
        setJobDetails(null); // Reset details on close
    };

    return (
        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
            <DialogTitle>Job Details</DialogTitle>
            <DialogContent>
                {loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                        <CircularProgress />
                    </Box>
                )}
                {error && <Alert severity="error">{error}</Alert>}
                {jobDetails && !loading && (
                    <Box sx={{ mt: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                            <Box>
                                <Typography variant="h6">{jobDetails.name}</Typography>
                                <Typography variant="body2" color="textSecondary">{jobDetails.branch.name} Branch</Typography>
                            </Box>
                            <Box sx={{ textAlign: { sm: 'right' } }}>
                                <Typography variant="subtitle1"><strong>Estimator:</strong> {jobDetails.estimate.salesperson.name}</Typography>
                                <Typography variant="subtitle1"><strong>Crew Leader:</strong> {jobDetails.crewLeader?.name || 'N/A'}</Typography>
                                <Typography variant="body2" color="textSecondary">
                                    Completed on: {new Date(jobDetails.closing_date).toLocaleDateString()}
                                </Typography>
                            </Box>
                        </Box>

                        <Divider sx={{ my: 2 }} />

                        <Typography variant="h6" gutterBottom>Regular Shifts</Typography>
                        <TableContainer component={Paper} sx={{ mb: 3 }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Crew Member</TableCell>
                                        <TableCell align="right">Hours Worked</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {jobDetails.shifts.map((shift, index) => (
                                        <TableRow key={index}>
                                            <TableCell>{shift.crewMember.name}</TableCell>
                                            <TableCell align="right">{parseFloat(shift.hours).toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        {jobDetails.jobSpecialShifts.length > 0 && (
                            <>
                                <Typography variant="h6" gutterBottom>Special Shifts</Typography>
                                <TableContainer component={Paper}>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Shift Type</TableCell>
                                                <TableCell align="right">Hours</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {jobDetails.jobSpecialShifts.map((shift, index) => (
                                                <TableRow key={index}>
                                                    <TableCell>{shift.specialShift.name}</TableCell>
                                                    <TableCell align="right">{parseFloat(shift.hours).toFixed(2)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </>
                        )}
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
};

export default JobDetailsModal; 