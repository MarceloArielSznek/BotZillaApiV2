import React, { useEffect, useState, useCallback } from 'react';
import {
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
    InputLabel,
    TablePagination,
    Tabs,
    Tab
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import { getJobs, deleteJob, createJob, updateJob, type CreateJobData, type UpdateJobData, addOrUpdateShifts, getJobById } from '../services/jobService';
import branchService from '../services/branchService';
import ShiftApproval from './ShiftApproval';
import salespersonService from '../services/salespersonService';
import crewService from '../services/crewService';
import type { Job, Branch, SalesPerson, CrewMember, JobDetails } from '../interfaces';
import JobDetailsModal from '../components/jobs/JobDetailsModal';
import JobFormModal from '../components/jobs/JobFormModal';

const Jobs: React.FC = () => {
    // Estado para las tabs
    const [currentTab, setCurrentTab] = useState(0);
    
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [formLoading, setFormLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedJobDetails, setSelectedJobDetails] = useState<JobDetails | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState<boolean>(false);
    const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);

    // Paginación
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalJobs, setTotalJobs] = useState(0);

    // Filter states
    const [branches, setBranches] = useState<Branch[]>([]);
    const [salespersons, setSalespersons] = useState<SalesPerson[]>([]);
    const [crewLeaders, setCrewLeaders] = useState<CrewMember[]>([]);
    const [filters, setFilters] = useState({
        search: '',
        branchId: '',
        salespersonId: '',
        crewLeaderId: '',
        startDate: '',
        endDate: '',
    });

    const fetchJobs = useCallback(async () => {
        try {
            setLoading(true);
            const activeFilters = {
                ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '')),
                page: page + 1,
                limit: rowsPerPage,
            };
            const response = await getJobs(activeFilters);
            setJobs(response.data);
            setTotalJobs(response.pagination.total);
            setError(null);
        } catch (err) {
            setError('Failed to fetch jobs.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, filters]);

    useEffect(() => {
        const fetchFilterData = async () => {
            try {
                const [branchesRes, salespersonsData, crewRes] = await Promise.all([
                    branchService.getBranches({ limit: 1000 }),
                    salespersonService.getSalesPersonsForFilter(),
                    crewService.getCrewMembers({ isLeader: true, limit: 1000 })
                ]);
                setBranches(branchesRes.branches || []);
                setSalespersons(salespersonsData || []);
                setCrewLeaders(crewRes.crewMembers || []);
            } catch (err) {
                setError('Failed to fetch filter options.');
            }
        };
        fetchFilterData();
    }, []);
    
    useEffect(() => {
        fetchJobs();
    }, [fetchJobs]);


    const handleFilterChange = (event: any) => {
        const { name, value } = event.target;
        setPage(0); // Reset page to 0 on filter change
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleOpenDetailsModal = (job: Job) => {
        getJobById(job.id).then(details => {
            setSelectedJobDetails(details);
            setIsDetailsModalOpen(true);
        });
    };

    const handleOpenFormModal = (job: Job | null) => {
        if (job) {
            getJobById(job.id).then(details => {
                setSelectedJobDetails(details);
                setIsFormModalOpen(true);
            });
        } else {
            setSelectedJobDetails(null);
            setIsFormModalOpen(true);
        }
    };

    const handleCloseModals = () => {
        setIsDetailsModalOpen(false);
        setIsFormModalOpen(false);
        setSelectedJobDetails(null);
    };

    const handleFormSubmit = async (jobData: CreateJobData | UpdateJobData, shifts: { regularShifts: any[], specialShifts: any[] }) => {
        try {
            setFormLoading(true);
            let jobId;

            if (selectedJobDetails) {
                // Update
                jobId = selectedJobDetails.id;
                await updateJob(jobId, jobData as UpdateJobData);
            } else {
                // Create
                const newJob = await createJob(jobData as CreateJobData);
                jobId = newJob.id;
            }

            // Update shifts
            if (jobId) {
                await addOrUpdateShifts(jobId, shifts);
            }

            handleCloseModals();
            fetchJobs();
        } catch (err) {
            setError('Failed to save job.');
            console.error(err);
        } finally {
            setFormLoading(false);
        }
    };

    const handleDeleteJob = async (jobId: number, jobName: string) => {
        if (window.confirm(`Are you sure you want to delete the job "${jobName}"? This action cannot be undone.`)) {
            try {
                await deleteJob(jobId);
                setJobs(prevJobs => prevJobs.filter(job => job.id !== jobId));
            } catch (err) {
                setError(`Failed to delete job ${jobName}.`);
                console.error(err);
            }
        }
    };


    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h4" gutterBottom sx={{ m: 0, fontWeight: 'bold' }}>
                    Jobs
                </Typography>
            </Box>

            {/* Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs 
                    value={currentTab} 
                    onChange={(_, newValue) => setCurrentTab(newValue)}
                    aria-label="job tabs"
                >
                    <Tab label="Jobs List" />
                    <Tab label="Shift Approval" />
                </Tabs>
            </Box>

            {/* Tab Content */}
            {currentTab === 0 && (
                <>
                    {/* Refresh button para la tab de Jobs */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mb: 2 }}>
                        <Tooltip title="Refresh Jobs">
                            <IconButton onClick={fetchJobs}>
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
                                onClick={() => setFilters({ search: '', branchId: '', salespersonId: '', crewLeaderId: '', startDate: '', endDate: '' })}
                                sx={{ ml: 'auto' }}
                                >
                                Clear filters
                                </Button>
                            </Box>
                            <Divider sx={{ mb: 2 }} />
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                                <TextField
                                    sx={{ flex: '1 1 200px' }}
                                    label="Search by Job Name"
                                    name="search"
                                    value={filters.search}
                                    onChange={handleFilterChange}
                                    size="small"
                                />
                                <FormControl fullWidth size="small" sx={{ flex: '1 1 150px' }}>
                                     <InputLabel>Branch</InputLabel>
                                    <Select value={filters.branchId} name="branchId" onChange={handleFilterChange} label="Branch">
                                        <MenuItem value=""><em>All Branches</em></MenuItem>
                                        {branches && branches.map(branch => <MenuItem key={branch.id} value={branch.id}>{branch.name}</MenuItem>)}
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
                                <Button variant="outlined" onClick={() => setFilters({ search: '', branchId: '', salespersonId: '', crewLeaderId: '', startDate: '', endDate: '' })}>Clear</Button>
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
                                                onClick={() => handleOpenDetailsModal(job)}
                                                sx={{ 
                                                    cursor: 'pointer',
                                                    '&:last-child td, &:last-child th': { border: 0 }
                                                }}
                                            >
                                                <TableCell component="th" scope="row">{job.name}</TableCell>
                                                <TableCell>{job.branch?.name || 'N/A'}</TableCell>
                                                <TableCell>{job.estimate?.salesperson?.name || 'N/A'}</TableCell>
                                                <TableCell>{job.crewLeader?.name || 'N/A'}</TableCell>
                                                <TableCell>{new Date(job.closing_date).toLocaleDateString()}</TableCell>
                                                <TableCell sx={{ textAlign: 'center' }}>
                                                    <Tooltip title="Edit Job">
                                                        <IconButton
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleOpenFormModal(job);
                                                            }}
                                                            size="small"
                                                        >
                                                            <EditIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Delete Job">
                                                        <IconButton
                                                            onClick={(e) => {
                                                                e.stopPropagation();
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
                            <TablePagination
                                rowsPerPageOptions={[5, 10, 25, 50]}
                                component="div"
                                count={totalJobs}
                                rowsPerPage={rowsPerPage}
                                page={page}
                                onPageChange={(e, newPage) => setPage(newPage)}
                                onRowsPerPageChange={(e) => {
                                    setRowsPerPage(parseInt(e.target.value, 10));
                                    setPage(0);
                                }}
                            />
                        </CardContent>
                    </Card>
                    )}
                </>
            )}

            {currentTab === 1 && (
                <ShiftApproval />
            )}

            {/* Modales (disponibles en ambas tabs) */}
            <JobDetailsModal
                jobId={selectedJobDetails?.id || null}
                open={isDetailsModalOpen}
                onClose={handleCloseModals}
            />
            <JobFormModal
                open={isFormModalOpen}
                onClose={handleCloseModals}
                onSubmit={handleFormSubmit}
                job={selectedJobDetails || undefined}
                loading={formLoading}
            />
        </Box>
    );
};

export default Jobs; 