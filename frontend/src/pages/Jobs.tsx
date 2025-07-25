import React, { useEffect, useState } from 'react';
import {
    Container,
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
    Box,
    TextField,
    Button,
    MenuItem,
    Select,
    IconButton,
    Tooltip,
    Card,
    CardContent,
    Divider,
    FormControl,
    InputLabel
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import type { SelectChangeEvent } from '@mui/material';
import { getJobs, deleteJob } from '../services/jobService';
import branchService from '../services/branchService';
import salespersonService from '../services/salespersonService';
import crewService from '../services/crewService';
import type { Job, Branch, SalesPerson, CrewMember } from '../interfaces';
import JobDetailsModal from '../components/jobs/JobDetailsModal';

const Jobs: React.FC = () => {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

    // Filter states
    const [branches, setBranches] = useState<Branch[]>([]);
    const [salespersons, setSalespersons] = useState<SalesPerson[]>([]);
    const [crewLeaders, setCrewLeaders] = useState<CrewMember[]>([]);
    const [filters, setFilters] = useState({
        branchId: '',
        salespersonId: '',
        crewLeaderId: '',
        startDate: '',
        endDate: '',
    });

    const fetchJobs = async () => {
        try {
            setLoading(true);
            const activeFilters = Object.fromEntries(
                Object.entries(filters).filter(([, value]) => value !== '')
            );
            const data = await getJobs(activeFilters);
            setJobs(data);
            setError(null);
        } catch (err) {
            setError('Failed to fetch jobs.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const fetchFilterData = async () => {
            try {
                const [branchesRes, salespersonsData, crewRes] = await Promise.all([
                    branchService.getBranches({ limit: 1000 }),
                    salespersonService.getSalesPersonsForFilter(),
                    crewService.getCrewMembers({ isLeader: true, limit: 1000 })
                ]);
                setBranches(branchesRes.branches);
                setSalespersons(salespersonsData);
                setCrewLeaders(crewRes.crewMembers);
            } catch (err) {
                setError('Failed to fetch filter options.');
            }
        };
        fetchFilterData();
    }, []);
    
    useEffect(() => {
        fetchJobs();
    }, [filters]);

    const handleFilterChange = (event: any) => {
        const { name, value } = event.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };
    
    const handleRowClick = (jobId: number) => {
        setSelectedJobId(jobId);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedJobId(null);
    };

    const handleDeleteJob = async (jobId: number, jobName: string) => {
        if (window.confirm(`Are you sure you want to delete the job "${jobName}"? This action cannot be undone.`)) {
            try {
                await deleteJob(jobId);
                setJobs(prevJobs => prevJobs.filter(job => job.id !== jobId));
                // Optionally, show a success notification
            } catch (err) {
                setError(`Failed to delete job ${jobName}.`);
                console.error(err);
            }
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
                <Typography variant="h4" gutterBottom sx={{ m: 0, fontWeight: 'bold' }}>
                    Jobs
                </Typography>
                <Tooltip title="Refresh Jobs">
                    <IconButton onClick={fetchJobs} sx={{ ml: 1 }}>
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
                        onClick={() => setFilters({ branchId: '', salespersonId: '', crewLeaderId: '', startDate: '', endDate: '' })}
                        sx={{ ml: 'auto' }}
                        >
                        Clear filters
                        </Button>
                    </Box>
                    <Divider sx={{ mb: 2 }} />
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                        <FormControl fullWidth size="small" sx={{ flex: '1 1 150px' }}>
                             <InputLabel>Branch</InputLabel>
                            <Select value={filters.branchId} name="branchId" onChange={handleFilterChange} label="Branch">
                                <MenuItem value=""><em>All Branches</em></MenuItem>
                                {branches.map(branch => <MenuItem key={branch.id} value={branch.id}>{branch.name}</MenuItem>)}
                            </Select>
                        </FormControl>
                         <FormControl fullWidth size="small" sx={{ flex: '1 1 150px' }}>
                            <InputLabel>Estimator</InputLabel>
                            <Select value={filters.salespersonId} name="salespersonId" onChange={handleFilterChange} label="Estimator">
                                <MenuItem value=""><em>All Estimators</em></MenuItem>
                                {salespersons.map(sp => <MenuItem key={sp.id} value={sp.id}>{sp.name}</MenuItem>)}
                            </Select>
                        </FormControl>
                        <FormControl fullWidth size="small" sx={{ flex: '1 1 150px' }}>
                            <InputLabel>Crew Leader</InputLabel>
                            <Select value={filters.crewLeaderId} name="crewLeaderId" onChange={handleFilterChange} label="Crew Leader">
                                <MenuItem value=""><em>All Crew Leaders</em></MenuItem>
                                {crewLeaders.map(cl => <MenuItem key={cl.id} value={cl.id}>{cl.name}</MenuItem>)}
                            </Select>
                        </FormControl>
                        <TextField sx={{ flex: '1 1 150px' }} type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} InputLabelProps={{ shrink: true }} label="From Date" size="small" />
                        <TextField sx={{ flex: '1 1 150px' }} type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} InputLabelProps={{ shrink: true }} label="To Date" size="small" />
                        <Button variant="outlined" onClick={() => setFilters({ branchId: '', salespersonId: '', crewLeaderId: '', startDate: '', endDate: '' })}>Clear</Button>
                    </Box>
                </CardContent>
            </Card>

            {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <CircularProgress />
                </Box>
            )}
            {error && <Alert severity="error">{error}</Alert>}
            {!loading && !error && (
            <Card>
                <CardContent sx={{ p: 0 }}>
                    <TableContainer component={Paper}>
                        <Table sx={{ minWidth: 650 }} aria-label="jobs table">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Job Name</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Branch</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Estimator</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Crew Leader</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Closing Date</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {jobs.map((job) => (
                                    <TableRow
                                        key={job.id}
                                        hover
                                        onClick={() => handleRowClick(job.id)}
                                        sx={{ 
                                            cursor: 'pointer',
                                            '&:last-child td, &:last-child th': { border: 0 }
                                        }}
                                    >
                                        <TableCell component="th" scope="row">{job.name}</TableCell>
                                        <TableCell>{job.branch.name}</TableCell>
                                        <TableCell>{job.estimate.salesperson.name}</TableCell>
                                        <TableCell>{job.crewLeader?.name || 'N/A'}</TableCell>
                                        <TableCell>{new Date(job.closing_date).toLocaleDateString()}</TableCell>
                                        <TableCell sx={{ textAlign: 'center' }}>
                                            <Tooltip title="Delete Job">
                                                <IconButton
                                                    onClick={(e) => {
                                                        e.stopPropagation(); // Prevent row click
                                                        handleDeleteJob(job.id, job.name);
                                                    }}
                                                    size="small"
                                                >
                                                    <DeleteIcon />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </CardContent>
            </Card>
            )}
            <JobDetailsModal
                jobId={selectedJobId}
                open={isModalOpen}
                onClose={handleCloseModal}
            />
        </Box>
    );
};

export default Jobs; 