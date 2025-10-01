import React, { useState, useEffect } from 'react';
import {
    Box,
    TextField,
    Button,
    MenuItem,
    Card,
    CardContent,
    Divider,
    Typography,
    FormControl,
    InputLabel,
    Select,
    SelectChangeEvent
} from '@mui/material';

export interface FilterValues {
    search: string;
    branch_name: string;
    salesperson_name: string;
    startDate: string;
    endDate: string;
    type: string;
    service_type: string;
}

interface InspectionReportsFiltersProps {
    onFilterChange: (filters: FilterValues) => void;
    branches: string[];
    salespeople: string[];
}

const InspectionReportsFilters: React.FC<InspectionReportsFiltersProps> = ({
    onFilterChange,
    branches,
    salespeople
}) => {
    const [filters, setFilters] = useState<FilterValues>({
        search: '',
        branch_name: '',
        salesperson_name: '',
        startDate: '',
        endDate: '',
        type: '',
        service_type: '',
    });

    const handleFilterChange = (field: keyof FilterValues, value: string) => {
        const newFilters = {
            ...filters,
            [field]: value
        };
        setFilters(newFilters);
        // Auto-apply filters on change (except search which has debounce)
        if (field !== 'search') {
            onFilterChange(newFilters);
        }
    };

    const handleSelectChange = (event: SelectChangeEvent<string>, field: keyof FilterValues) => {
        handleFilterChange(field, event.target.value);
    };

    const handleClearFilters = () => {
        const clearedFilters: FilterValues = {
            search: '',
            branch_name: '',
            salesperson_name: '',
            startDate: '',
            endDate: '',
            type: '',
            service_type: '',
        };
        setFilters(clearedFilters);
        onFilterChange(clearedFilters);
    };

    // Auto-apply search filter after typing stops (debounce)
    useEffect(() => {
        const timer = setTimeout(() => {
            onFilterChange(filters);
        }, 500);
        return () => clearTimeout(timer);
    }, [filters.search]);

    return (
        <Card sx={{ mb: 3 }}>
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">Filters</Typography>
                    <Button
                        size="small"
                        onClick={handleClearFilters}
                        sx={{ ml: 'auto' }}
                    >
                        Clear filters
                    </Button>
                </Box>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                    <TextField
                        sx={{ flex: '1 1 200px' }}
                        label="Search by estimate name, client name, email, phone, or address..."
                        name="search"
                        value={filters.search}
                        onChange={(e) => handleFilterChange('search', e.target.value)}
                        size="small"
                    />
                    <FormControl fullWidth size="small" sx={{ flex: '1 1 150px' }}>
                        <InputLabel>Branch</InputLabel>
                        <Select 
                            value={filters.branch_name} 
                            name="branch_name" 
                            onChange={(e) => handleSelectChange(e, 'branch_name')} 
                            label="Branch"
                        >
                            <MenuItem value=""><em>All Branches</em></MenuItem>
                            {branches.map((branch) => (
                                <MenuItem key={branch} value={branch}>
                                    {branch}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl fullWidth size="small" sx={{ flex: '1 1 150px' }}>
                        <InputLabel>Salesperson</InputLabel>
                        <Select 
                            value={filters.salesperson_name} 
                            name="salesperson_name" 
                            onChange={(e) => handleSelectChange(e, 'salesperson_name')} 
                            label="Salesperson"
                        >
                            <MenuItem value=""><em>All Salespeople</em></MenuItem>
                            {salespeople.map((salesperson) => (
                                <MenuItem key={salesperson} value={salesperson}>
                                    {salesperson}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl fullWidth size="small" sx={{ flex: '1 1 150px' }}>
                        <InputLabel>Status</InputLabel>
                        <Select 
                            value={filters.type} 
                            name="type" 
                            onChange={(e) => handleSelectChange(e, 'type')} 
                            label="Status"
                        >
                            <MenuItem value=""><em>All Status</em></MenuItem>
                            <MenuItem value="Lead & Opportunity">Lead & Opportunity</MenuItem>
                            <MenuItem value="Opportunity">Opportunity</MenuItem>
                            <MenuItem value="Lead">Lead</MenuItem>
                            <MenuItem value="Report">Report</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl fullWidth size="small" sx={{ flex: '1 1 150px' }}>
                        <InputLabel>Service Type</InputLabel>
                        <Select 
                            value={filters.service_type} 
                            name="service_type" 
                            onChange={(e) => handleSelectChange(e, 'service_type')} 
                            label="Service Type"
                        >
                            <MenuItem value=""><em>All Services</em></MenuItem>
                            <MenuItem value="Both">Both</MenuItem>
                            <MenuItem value="Roofing">Roofing</MenuItem>
                            <MenuItem value="HVAC">HVAC</MenuItem>
                        </Select>
                    </FormControl>
                    <TextField 
                        sx={{ flex: '1 1 150px' }} 
                        type="date" 
                        name="startDate" 
                        value={filters.startDate} 
                        onChange={(e) => handleFilterChange('startDate', e.target.value)} 
                        InputLabelProps={{ shrink: true }} 
                        label="From Date" 
                        size="small" 
                    />
                    <TextField 
                        sx={{ flex: '1 1 150px' }} 
                        type="date" 
                        name="endDate" 
                        value={filters.endDate} 
                        onChange={(e) => handleFilterChange('endDate', e.target.value)} 
                        InputLabelProps={{ shrink: true }} 
                        label="To Date" 
                        size="small" 
                    />
                    <Button 
                        variant="outlined" 
                        onClick={handleClearFilters}
                    >
                        Clear
                    </Button>
                </Box>
            </CardContent>
        </Card>
    );
};

export default InspectionReportsFilters;

