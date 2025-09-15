import React, { useState, useEffect } from 'react';
import {
    Dialog, 
    DialogTitle, 
    DialogContent, 
    DialogActions, 
    Button, 
    TextField, 
    CircularProgress, 
    Box, 
    FormControl, 
    InputLabel, 
    Select, 
    MenuItem,
    Typography
} from '@mui/material';
import type { Branch, SalesPerson, EstimateStatus } from '../../interfaces';
import type { Estimate } from '../../services/estimateService';
import branchService from '../../services/branchService';
import estimateService from '../../services/estimateService';
import type { SelectChangeEvent } from '@mui/material';

interface EstimateFormModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (estimateData: Partial<Estimate>) => void;
    estimate?: Estimate;
    loading: boolean;
}

const EstimateFormModal: React.FC<EstimateFormModalProps> = ({ 
    open, 
    onClose, 
    onSubmit, 
    estimate, 
    loading 
}) => {
    const [formData, setFormData] = useState<Partial<Estimate>>({});
    const [branches, setBranches] = useState<Branch[]>([]);
    const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([]);
    const [statuses, setStatuses] = useState<EstimateStatus[]>([]);
    const [formLoading, setFormLoading] = useState(false);

    // Cargar datos iniciales cuando se abre el modal
    useEffect(() => {
        if (open) {
            loadInitialData();
        }
    }, [open]);

    // Llenar el formulario cuando se recibe un estimate para editar
    useEffect(() => {
        if (estimate) {
            console.log('🔍 Estimate data for form:', estimate);
            setFormData({
                name: estimate.name || '',
                customer_name: estimate.customer_name || '',
                customer_address: estimate.customer_address || '',
                customer_email: estimate.customer_email || '',
                customer_phone: estimate.customer_phone || '',
                crew_notes: estimate.crew_notes || '',
                price: estimate.price || null,
                retail_cost: estimate.retail_cost || null,
                final_price: estimate.final_price || null,
                sub_service_retail_cost: estimate.sub_service_retail_cost || null,
                discount: estimate.discount || null,
                attic_tech_hours: estimate.attic_tech_hours || null,
                // Obtener los IDs correctos de las relaciones
                sales_person_id: estimate.SalesPerson?.id || estimate.sales_person_id || null,
                branch_id: estimate.Branch?.id || estimate.branch_id || null,
                status_id: estimate.EstimateStatus?.id || estimate.status_id || null,
            });
            console.log('📝 Form data set:', {
                sales_person_id: estimate.SalesPerson?.id || estimate.sales_person_id,
                branch_id: estimate.Branch?.id || estimate.branch_id,
                status_id: estimate.EstimateStatus?.id || estimate.status_id
            });
        } else {
            // Resetear formulario para nuevo estimate
            setFormData({
                name: '',
                customer_name: '',
                customer_address: '',
                customer_email: '',
                customer_phone: '',
                crew_notes: '',
                price: null,
                retail_cost: null,
                final_price: null,
                sub_service_retail_cost: null,
                discount: null,
                attic_tech_hours: null,
                sales_person_id: null,
                branch_id: null,
                status_id: null,
            });
        }
    }, [estimate]);

    const loadInitialData = async () => {
        try {
            setFormLoading(true);
            const [branchesData, salesPersonsData, statusesData] = await Promise.all([
                estimateService.getBranches(),
                estimateService.getSalesPersons({}),
                estimateService.getEstimateStatuses()
            ]);
            
            setBranches(Array.isArray(branchesData) ? branchesData : []);
            setSalesPersons(Array.isArray(salesPersonsData) ? salesPersonsData : []);
            setStatuses(Array.isArray(statusesData) ? statusesData : []);
        } catch (error) {
            console.error('Error loading form data:', error);
        } finally {
            setFormLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ 
            ...prev, 
            [name]: value === '' ? null : value 
        }));
    };

    const handleSelectChange = (e: SelectChangeEvent<unknown>) => {
        const { name, value } = e.target;
        console.log(`🔄 Select change: ${name} = ${value} (type: ${typeof value})`);
        setFormData(prev => ({ 
            ...prev, 
            [name as string]: value === '' || value === null ? null : Number(value)
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    const handleClose = () => {
        setFormData({});
        onClose();
    };

    return (
        <Dialog 
            open={open} 
            onClose={handleClose} 
            maxWidth="md" 
            fullWidth
            PaperProps={{
                sx: { minHeight: '500px' }
            }}
        >
            <DialogTitle>
                {estimate ? `Edit Estimate: ${estimate.name}` : 'Create New Estimate'}
            </DialogTitle>
            
            <form onSubmit={handleSubmit}>
                <DialogContent>
                    {formLoading ? (
                        <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                            <CircularProgress />
                        </Box>
                    ) : (
                        <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {/* Basic Information */}
                            <TextField
                                fullWidth
                                label="Estimate Name"
                                name="name"
                                value={formData.name || ''}
                                onChange={handleChange}
                                required
                            />

                            <FormControl fullWidth>
                                <InputLabel>Branch</InputLabel>
                                <Select
                                    name="branch_id"
                                    value={formData.branch_id ?? ''}
                                    onChange={handleSelectChange}
                                    label="Branch"
                                >
                                    <MenuItem value="">
                                        <em>Select Branch</em>
                                    </MenuItem>
                                    {branches && branches.map((branch) => (
                                        <MenuItem key={branch.id} value={branch.id}>
                                            {branch.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <FormControl fullWidth>
                                <InputLabel>Salesperson</InputLabel>
                                <Select
                                    name="sales_person_id"
                                    value={formData.sales_person_id ?? ''}
                                    onChange={handleSelectChange}
                                    label="Salesperson"
                                >
                                    <MenuItem value="">
                                        <em>Select Salesperson</em>
                                    </MenuItem>
                                    {salesPersons && salesPersons.map((person) => (
                                        <MenuItem key={person.id} value={person.id}>
                                            {person.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <FormControl fullWidth>
                                <InputLabel>Status</InputLabel>
                                <Select
                                    name="status_id"
                                    value={formData.status_id ?? ''}
                                    onChange={handleSelectChange}
                                    label="Status"
                                >
                                    <MenuItem value="">
                                        <em>Select Status</em>
                                    </MenuItem>
                                    {statuses && statuses.map((status) => (
                                        <MenuItem key={status.id} value={status.id}>
                                            {status.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            {/* Customer Information */}
                            <TextField
                                fullWidth
                                label="Customer Name"
                                name="customer_name"
                                value={formData.customer_name || ''}
                                onChange={handleChange}
                            />

                            <TextField
                                fullWidth
                                label="Customer Address"
                                name="customer_address"
                                value={formData.customer_address || ''}
                                onChange={handleChange}
                            />

                            <TextField
                                fullWidth
                                label="Customer Email"
                                name="customer_email"
                                type="email"
                                value={formData.customer_email || ''}
                                onChange={handleChange}
                            />

                            <TextField
                                fullWidth
                                label="Customer Phone"
                                name="customer_phone"
                                value={formData.customer_phone || ''}
                                onChange={handleChange}
                            />

                            {/* Financial Information */}
                            <TextField
                                fullWidth
                                label="Final Price"
                                name="final_price"
                                type="number"
                                value={formData.final_price || ''}
                                onChange={handleChange}
                                inputProps={{ step: "0.01" }}
                            />

                            <TextField
                                fullWidth
                                label="Retail Cost"
                                name="retail_cost"
                                type="number"
                                value={formData.retail_cost || ''}
                                onChange={handleChange}
                                inputProps={{ step: "0.01" }}
                            />

                            <TextField
                                fullWidth
                                label="Discount (%)"
                                name="discount"
                                type="number"
                                value={formData.discount || ''}
                                onChange={handleChange}
                                inputProps={{ step: "0.01" }}
                            />

                            <TextField
                                fullWidth
                                label="Attic Tech Hours"
                                name="attic_tech_hours"
                                type="number"
                                value={formData.attic_tech_hours || ''}
                                onChange={handleChange}
                                inputProps={{ step: "0.1" }}
                            />

                            <TextField
                                fullWidth
                                label="Price"
                                name="price"
                                type="number"
                                value={formData.price || ''}
                                onChange={handleChange}
                                inputProps={{ step: "0.01" }}
                            />

                            <TextField
                                fullWidth
                                label="Sub Service Retail Cost"
                                name="sub_service_retail_cost"
                                type="number"
                                value={formData.sub_service_retail_cost || ''}
                                onChange={handleChange}
                                inputProps={{ step: "0.01" }}
                            />

                            {/* Notes */}
                            <TextField
                                fullWidth
                                label="Crew Notes"
                                name="crew_notes"
                                multiline
                                rows={4}
                                value={formData.crew_notes || ''}
                                onChange={handleChange}
                            />
                        </Box>
                    )}
                </DialogContent>

                <DialogActions>
                    <Button onClick={handleClose}>
                        Cancel
                    </Button>
                    <Button 
                        type="submit" 
                        variant="contained" 
                        disabled={loading || formLoading}
                    >
                        {loading ? (
                            <CircularProgress size={20} />
                        ) : (
                            estimate ? 'Update' : 'Create'
                        )}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};

export default EstimateFormModal;
