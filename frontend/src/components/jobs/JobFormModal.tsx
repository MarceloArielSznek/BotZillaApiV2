import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, CircularProgress, Box, FormControl, InputLabel, Select, MenuItem, Autocomplete,
    Typography, IconButton, Table, TableBody, TableCell, TableHead, TableRow, Divider
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import type { Branch, CrewMember, SpecialShift, JobDetails } from '../../interfaces';
import type { CreateJobData, UpdateJobData, ShiftData } from '../../services/jobService';
import branchService from '../../services/branchService';
import crewService from '../../services/crewService';
import employeeService from '../../services/employeeService';
import type { Employee } from '../../services/employeeService';
import { getSpecialShifts } from '../../services/statusService'; 
import type { SelectChangeEvent } from '@mui/material';
import estimateService from '../../services/estimateService';
import type { Estimate } from '../../services/estimateService';

interface JobFormModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (jobData: CreateJobData | UpdateJobData, shifts: { regularShifts: ShiftData[], specialShifts: ShiftData[] }) => void;
    job?: JobDetails;
    loading: boolean;
}

const JobFormModal: React.FC<JobFormModalProps> = ({ open, onClose, onSubmit, job, loading }) => {
    const [formData, setFormData] = useState<Partial<CreateJobData>>({});
    const [branches, setBranches] = useState<Branch[]>([]);
    const [crewLeaders, setCrewLeaders] = useState<CrewMember[]>([]);
    const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
    const [specialShiftTypes, setSpecialShiftTypes] = useState<SpecialShift[]>([]);
    const [soldEstimates, setSoldEstimates] = useState<Estimate[]>([]);

    const [regularShifts, setRegularShifts] = useState<ShiftData[]>([]);
    const [specialShifts, setSpecialShifts] = useState<ShiftData[]>([]);

    useEffect(() => {
        if (open) {
            branchService.getBranches({}).then(res => setBranches(res.branches));
            crewService.getCrewMembers({ isLeader: true }).then(res => setCrewLeaders(res.crewMembers));
            // Cargar TODOS los employees (sin filtrar por status para que aparezcan en el dropdown)
            employeeService.getAll({ limit: 1000 }).then(res => {
                const allEmployees = res.data || [];
                console.log('🔍 Loaded employees:', allEmployees.length, allEmployees.map(e => ({ id: e.id, name: `${e.first_name} ${e.last_name}`, status: e.status })));
                setAllEmployees(allEmployees);
            });
            getSpecialShifts().then(res => setSpecialShiftTypes(res));
            
            // Cargar los estimados disponibles
            const soldEstimatesPromise = estimateService.getSoldEstimates();
            
            soldEstimatesPromise.then(res => {
                let estimatesWithOptions = res;

                // Si estamos editando y el job tiene un estimate_id
                if (job && job.estimate_id) {
                    // Si el estimate actual no está en la lista, lo buscamos y lo añadimos
                    if (!res.some(e => e.id === job.estimate_id)) {
                        estimateService.getEstimateDetails(job.estimate_id).then(currentEstimate => {
                            // Añadimos el estimate del job actual a la lista de opciones
                            setSoldEstimates([currentEstimate, ...estimatesWithOptions]);
                        });
                    } else {
                        setSoldEstimates(estimatesWithOptions);
                    }
                } else {
                    setSoldEstimates(estimatesWithOptions);
                }
            });
        }
    }, [open, job]);

    useEffect(() => {
        if (job) {
            setFormData({
                name: job.name || '',
                closing_date: job.closing_date ? new Date(job.closing_date).toISOString().split('T')[0] : '',
                branch_id: job.branch?.id || null,
                crew_leader_id: job.crewLeader?.id || null,
                crew_leader_hours: job.crew_leader_hours || 0,
                note: job.note || '',
                estimate_id: job.estimate_id || null,
            });
            
            // Debug: Ver estructura de shifts
            console.log('🔍 Job shifts data:', job.shifts);
            
            const mappedShifts = job.shifts?.map(s => {
                const crewMemberId = s.crew_member_id || s.crewMember?.id || s.employee_id;
                console.log('🔍 Shift mapping:', {
                    crew_member_id: s.crew_member_id,
                    crewMember: s.crewMember,
                    employee_id: s.employee_id,
                    mapped: crewMemberId
                });
                return {
                    crew_member_id: crewMemberId,
                    hours: s.hours,
                    is_leader: s.is_leader
                };
            }) || [];
            
            console.log('🔍 Mapped shifts:', mappedShifts);
            setRegularShifts(mappedShifts);
            
            setSpecialShifts(job.jobSpecialShifts?.map(s => ({
                special_shift_id: s.special_shift_id || s.specialShift?.id,
                hours: s.hours
            })) || []);
        } else {
            setFormData({ name: '', closing_date: '', branch_id: null, crew_leader_id: null, note: '', estimate_id: null });
            setRegularShifts([]);
            setSpecialShifts([]);
        }
    }, [job]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };
    
    const handleSelectChange = (e: SelectChangeEvent<number>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value === '' ? null : e.target.value });
    };

    const handleAutocompleteChange = (name: string, value: any) => {
        setFormData({ ...formData, [name]: value });
    };

    const handleShiftChange = (index: number, field: string, value: any, type: 'regular' | 'special') => {
        if (type === 'regular') {
            const updatedShifts = [...regularShifts];
            updatedShifts[index] = { ...updatedShifts[index], [field]: value };
            setRegularShifts(updatedShifts);
        } else {
            const updatedShifts = [...specialShifts];
            updatedShifts[index] = { ...updatedShifts[index], [field]: value };
            setSpecialShifts(updatedShifts);
        }
    };
    
    const addShift = (type: 'regular' | 'special') => {
        if (type === 'regular') {
            setRegularShifts([...regularShifts, { crew_member_id: 0, hours: 0 }]);
        } else {
            setSpecialShifts([...specialShifts, { special_shift_id: 0, hours: 0 }]);
        }
    };

    const removeShift = (index: number, type: 'regular' | 'special') => {
        if (type === 'regular') {
            setRegularShifts(regularShifts.filter((_, i) => i !== index));
        } else {
            setSpecialShifts(specialShifts.filter((_, i) => i !== index));
        }
    };

    const handleSubmit = () => {
        onSubmit(formData, { regularShifts, specialShifts });
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>{job ? 'Edit Job' : 'Create New Job'}</DialogTitle>
            <DialogContent>
                {/* Job Details Form */}
                <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                        name="name"
                        label="Job Name"
                        value={formData.name || ''}
                        onChange={handleChange}
                        fullWidth
                        required
                    />
                    <TextField
                        name="closing_date"
                        label="Closing Date"
                        type="date"
                        value={formData.closing_date || ''}
                        onChange={handleChange}
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                    />
                    <Autocomplete
                        options={soldEstimates}
                        getOptionLabel={(option) => `${option.name} (${option.customer_name})`}
                        value={soldEstimates.find(e => e.id === formData.estimate_id) || null}
                        onChange={(_, newValue) => handleAutocompleteChange('estimate_id', newValue?.id ?? null)}
                        renderInput={(params) => (
                            <TextField {...params} label="Estimate" />
                        )}
                    />
                    <FormControl fullWidth required>
                        <InputLabel>Branch</InputLabel>
                        <Select
                            name="branch_id"
                            value={formData.branch_id || ''}
                            onChange={handleSelectChange}
                        >
                            {branches.map((branch) => (
                                <MenuItem key={branch.id} value={branch.id}>{branch.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <Autocomplete
                        options={crewLeaders}
                        getOptionLabel={(option) => option.name}
                        value={crewLeaders.find(c => c.id === formData.crew_leader_id) || null}
                        onChange={(_, newValue) => handleAutocompleteChange('crew_leader_id', newValue?.id ?? null)}
                        renderInput={(params) => (
                            <TextField {...params} label="Crew Leader" />
                        )}
                    />
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <TextField
                            name="crew_leader_hours"
                            label="Crew Leader Planned Hours"
                            type="number"
                            value={formData.crew_leader_hours || ''}
                            onChange={handleChange}
                            fullWidth
                        />
                        <TextField
                            label="AT Planned Hours"
                            value={
                                formData.estimate_id 
                                ? (soldEstimates.find(e => e.id === formData.estimate_id)?.attic_tech_hours || 'N/A') 
                                : ''
                            }
                            fullWidth
                            disabled
                            InputLabelProps={{
                                shrink: !!formData.estimate_id,
                            }}
                        />
                    </Box>
                    <TextField
                        name="note"
                        label="Notes"
                        value={formData.note || ''}
                        onChange={handleChange}
                        fullWidth
                        multiline
                        rows={3}
                    />
                </Box>
                
                <Divider sx={{ my: 3 }} />

                {/* Shifts Management */}
                <Box>
                    <Typography variant="h6" gutterBottom>Regular Shifts</Typography>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Crew Member</TableCell>
                                <TableCell>Hours</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {regularShifts.map((shift, index) => (
                                <TableRow key={index}>
                                    <TableCell>
                                        <FormControl fullWidth size="small">
                                            <Select value={shift.crew_member_id || 0} onChange={(e) => handleShiftChange(index, 'crew_member_id', e.target.value, 'regular')}>
                                                <MenuItem value={0} disabled>Select Employee</MenuItem>
                                                {allEmployees.map(emp => (
                                                    <MenuItem key={emp.id} value={emp.id}>
                                                        {emp.first_name} {emp.last_name}
                                                        {emp.status !== 'active' && ` (${emp.status})`}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </TableCell>
                                    <TableCell>
                                        <TextField type="number" size="small" value={shift.hours} onChange={(e) => handleShiftChange(index, 'hours', e.target.value, 'regular')} />
                                    </TableCell>
                                    <TableCell align="right">
                                        <IconButton onClick={() => removeShift(index, 'regular')}><DeleteIcon /></IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <Button startIcon={<AddIcon />} onClick={() => addShift('regular')} sx={{ mt: 1 }}>Add Regular Shift</Button>

                    <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>Special Shifts</Typography>
                    <Table size="small">
                         <TableHead>
                            <TableRow>
                                <TableCell>Shift Type</TableCell>
                                <TableCell>Hours</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                             {specialShifts.map((shift, index) => (
                                <TableRow key={index}>
                                    <TableCell>
                                        <FormControl fullWidth size="small">
                                            <Select value={shift.special_shift_id} onChange={(e) => handleShiftChange(index, 'special_shift_id', e.target.value, 'special')}>
                                                {specialShiftTypes.map(st => <MenuItem key={st.id} value={st.id}>{st.name}</MenuItem>)}
                                            </Select>
                                        </FormControl>
                                    </TableCell>
                                    <TableCell>
                                         <TextField type="number" size="small" value={shift.hours} onChange={(e) => handleShiftChange(index, 'hours', e.target.value, 'special')} />
                                    </TableCell>
                                    <TableCell align="right">
                                        <IconButton onClick={() => removeShift(index, 'special')}><DeleteIcon /></IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <Button startIcon={<AddIcon />} onClick={() => addShift('special')} sx={{ mt: 1 }}>Add Special Shift</Button>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={loading}>Cancel</Button>
                <Button onClick={handleSubmit} variant="contained" disabled={loading}>
                    {loading ? <CircularProgress size={24} /> : (job ? 'Update' : 'Create')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default JobFormModal; 