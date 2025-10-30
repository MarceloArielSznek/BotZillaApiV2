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
    Tab,
    Chip,
    Checkbox
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import { getJobs, deleteJob, createJob, updateJob, type CreateJobData, type UpdateJobData, addOrUpdateShifts, getJobById } from '../services/jobService';
import branchService from '../services/branchService';
import Performance from './Performance';
import PerformanceApproval from '../components/PerformanceApproval';
import OverrunJobs from './OverrunJobs';
import salespersonService from '../services/salespersonService';
import crewService from '../services/crewService';
import { getJobStatuses } from '../services/statusService';
import type { Job, Branch, SalesPerson, CrewMember, JobDetails } from '../interfaces';
import JobDetailsModal from '../components/jobs/JobDetailsModal';
import JobFormModal from '../components/jobs/JobFormModal';
import JobsStatsCards from '../components/jobs/JobsStatsCards';

const Jobs: React.FC = () => {
    // Estado para las tabs principales
    const [currentTab, setCurrentTab] = useState(0);
    // Estado para las sub-tabs de Performance
    const [performanceTab, setPerformanceTab] = useState(0);
    
    const [jobs, setJobs] = useState<Job[]>([]);
    const [allJobs, setAllJobs] = useState<Job[]>([]); // Todos los jobs para stats
    const [loading, setLoading] = useState<boolean>(true);
    const [statsLoading, setStatsLoading] = useState<boolean>(true);
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
    const [jobStatuses, setJobStatuses] = useState<{ id: number; name: string }[]>([]);
    const [filters, setFilters] = useState({
        search: '',
        branchId: '',
        salespersonId: '',
        crewLeaderId: '',
        statusId: '',
        startDate: '',
        endDate: '',
        inPayload: '', // '' = All, 'true' = In Payload, 'false' = Not in Payload
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

    const fetchAllJobsForStats = useCallback(async () => {
        try {
            setStatsLoading(true);
            // Obtener todos los jobs sin paginación (límite alto)
            const response = await getJobs({ limit: 10000, page: 1 });
            setAllJobs(response.data);
        } catch (err) {
            console.error('Failed to fetch all jobs for stats:', err);
        } finally {
            setStatsLoading(false);
        }
    }, []);

    useEffect(() => {
        const fetchFilterData = async () => {
            try {
                const [branchesRes, salespersonsData, crewRes, statusesData] = await Promise.all([
                    branchService.getBranches({ limit: 1000 }),
                    salespersonService.getSalesPersonsForFilter(),
                    crewService.getCrewMembers({ isLeader: true, limit: 1000 }),
                    getJobStatuses()
                ]);
                setBranches(branchesRes.branches || []);
                setSalespersons(salespersonsData || []);
                setCrewLeaders(crewRes.crewMembers || []);
                setJobStatuses(statusesData || []);
            } catch (err) {
                setError('Failed to fetch filter options.');
            }
        };
        fetchFilterData();
        // Fetch all jobs for stats on mount
        fetchAllJobsForStats();
    }, [fetchAllJobsForStats]);
    
    // Debounce para fetchJobs: esperar 500ms después de cambios en filters.search
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchJobs();
        }, filters.search ? 500 : 0); // Si hay búsqueda, esperar 500ms; si no, cargar inmediatamente
        
        return () => clearTimeout(timeoutId);
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

    const handleToggleInPayload = async (e: React.ChangeEvent<HTMLInputElement>, jobId: number) => {
        e.stopPropagation(); // Prevent row click
        const newInPayload = e.target.checked;
        
        try {
            await updateJob(jobId, { in_payload: newInPayload });
            // Update local state
            setJobs(prevJobs => 
                prevJobs.map(job => 
                    job.id === jobId ? { ...job, in_payload: newInPayload } as Job : job
                )
            );
        } catch (err) {
            setError('Failed to update payload status.');
            console.error(err);
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

            {/* Tabs principales */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs 
                    value={currentTab} 
                    onChange={(_, newValue) => setCurrentTab(newValue)}
                    aria-label="job tabs"
                >
                    <Tab label="Jobs List" />
                    <Tab label="Performance" />
                    <Tab label="Jobs Analysis" />
                </Tabs>
            </Box>

            {/* Tab Content */}
            {currentTab === 0 && (
                <>
                    {/* Statistics Cards */}
                    <JobsStatsCards 
                        jobs={allJobs} 
                        totalJobs={allJobs.length} 
                        loading={statsLoading}
                    />

                    {/* Filter Section */}
                    <Card sx={{ mb: 3 }}>
                        <CardContent>
                             <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <Typography variant="h6">Filters</Typography>
                                <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                                    <Button
                                        size="small"
                                        onClick={() => setFilters({ search: '', branchId: '', salespersonId: '', crewLeaderId: '', statusId: '', startDate: '', endDate: '', inPayload: '' })}
                                    >
                                        Clear filters
                                    </Button>
                                    <Tooltip title="Refresh Jobs">
                                        <IconButton onClick={fetchJobs} size="small">
                                            <RefreshIcon />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
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
                                <FormControl fullWidth size="small" sx={{ flex: '1 1 150px' }}>
                                    <InputLabel>Status</InputLabel>
                                    <Select value={filters.statusId} name="statusId" onChange={handleFilterChange} label="Status">
                                        <MenuItem value=""><em>All Statuses</em></MenuItem>
                                        {jobStatuses.map(status => <MenuItem key={status.id} value={status.id}>{status.name}</MenuItem>)}
                                    </Select>
                                </FormControl>
                                <TextField sx={{ flex: '1 1 150px' }} type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} InputLabelProps={{ shrink: true }} label="From Date" size="small" />
                                <TextField sx={{ flex: '1 1 150px' }} type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} InputLabelProps={{ shrink: true }} label="To Date" size="small" />
                                <FormControl fullWidth size="small" sx={{ flex: '1 1 150px' }}>
                                    <InputLabel>In Payload</InputLabel>
                                    <Select value={filters.inPayload} name="inPayload" onChange={handleFilterChange} label="In Payload">
                                        <MenuItem value=""><em>All Jobs</em></MenuItem>
                                        <MenuItem value="true">In Payload</MenuItem>
                                        <MenuItem value="false">Not in Payload</MenuItem>
                                    </Select>
                                </FormControl>
                                <Button variant="outlined" onClick={() => setFilters({ search: '', branchId: '', salespersonId: '', crewLeaderId: '', statusId: '', startDate: '', endDate: '', inPayload: '' })}>Clear</Button>
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
                            <TableContainer component={Paper} sx={{ maxWidth: '100%', overflowX: 'auto' }}>
                                <Table sx={{ minWidth: 1000 }} aria-label="jobs table">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 'bold', minWidth: 180 }}>Job Name</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', minWidth: 120 }}>Branch</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', minWidth: 120 }}>Estimator</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', minWidth: 120 }}>Crew Leader</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', minWidth: 100 }}>Status</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', minWidth: 130 }}>Shifts Approved</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', minWidth: 80, textAlign: 'center' }}>Overrun</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', minWidth: 100, textAlign: 'center' }}>In Payload</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', minWidth: 110 }}>Closing Date</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', minWidth: 100, textAlign: 'center' }}>Actions</TableCell>
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
                                                <TableCell>{job.status?.name || 'N/A'}</TableCell>
                                                <TableCell>{(job as any).shifts_status || 'N/A'}</TableCell>
                                                <TableCell>
                                                    {(job as any).is_overrun ? (
                                                        <Chip label="Yes" color="error" size="small" />
                                                    ) : (
                                                        <Chip label="No" color="success" size="small" />
                                                    )}
                                                </TableCell>
                                                <TableCell sx={{ textAlign: 'center' }}>
                                                    <Tooltip title={(job as any).in_payload ? "In PayLoad" : "Not in PayLoad"}>
                                                        <Checkbox
                                                            checked={(job as any).in_payload || false}
                                                            onChange={(e) => handleToggleInPayload(e, job.id)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            color="primary"
                                                            size="small"
                                                        />
                                                    </Tooltip>
                                                </TableCell>
                                                <TableCell>{job.closing_date ? new Date(job.closing_date).toLocaleDateString() : 'N/A'}</TableCell>
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
                <Box>
                    {/* Sub-tabs de Performance */}
                    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                        <Tabs 
                            value={performanceTab} 
                            onChange={(_, newValue) => setPerformanceTab(newValue)}
                            aria-label="performance tabs"
                        >
                            <Tab label="Jobs Sync" />
                            <Tab label="Shifts Approvals" />
                        </Tabs>
                    </Box>

                    {/* Sub-tab Content */}
                    {performanceTab === 0 && <Performance />}
                    {performanceTab === 1 && <PerformanceApproval />}
                </Box>
            )}

            {currentTab === 2 && (
                <OverrunJobs />
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