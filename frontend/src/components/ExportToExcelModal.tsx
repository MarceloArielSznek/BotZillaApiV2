import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    Divider,
    FormGroup,
    FormControlLabel,
    Checkbox,
    TextField,
    IconButton,
    Paper,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Alert,
} from '@mui/material';
import { 
    Close as CloseIcon,
    Download as DownloadIcon,
    CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import ExcelJS from 'exceljs';
import inspectionReportService from '../services/inspectionReportService';

interface ExportToExcelModalProps {
    open: boolean;
    onClose: () => void;
}

interface ColumnConfig {
    id: string;
    label: string;
    key: string;
}

const ExportToExcelModal: React.FC<ExportToExcelModalProps> = ({ open, onClose }) => {
    const [selectedColumns, setSelectedColumns] = useState<string[]>([
        'estimate_name',
        'client_name',
        'branch_name',
        'status',
        'attic_tech_created_at'
    ]);
    
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        branch_name: '',
        salesperson_name: '',
        type: '',
        service_type: '',
    });

    const [branches, setBranches] = useState<string[]>([]);
    const [salespeople, setSalespeople] = useState<string[]>([]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Load filter options when modal opens
    useEffect(() => {
        if (open) {
            loadFilterOptions();
        }
    }, [open]);

    const loadFilterOptions = async () => {
        try {
            const response = await inspectionReportService.getAll(1, 10000, {});
            if (response && Array.isArray(response.data)) {
                const uniqueBranches = Array.from(new Set(response.data.map((r: any) => r.branch_name).filter(Boolean)));
                const uniqueSalespeople = Array.from(new Set(response.data.map((r: any) => r.salesperson_name).filter(Boolean)));
                setBranches(uniqueBranches as string[]);
                setSalespeople(uniqueSalespeople as string[]);
            }
        } catch (err) {
            console.error('Failed to load filter options:', err);
        }
    };

    const availableColumns: ColumnConfig[] = [
        { id: 'estimate_name', label: 'Estimate Name', key: 'estimate_name' },
        { id: 'client_name', label: 'Client Name', key: 'client_name' },
        { id: 'client_phone', label: 'Client Phone', key: 'client_phone' },
        { id: 'client_email', label: 'Client Email', key: 'client_email' },
        { id: 'client_address', label: 'Client Address', key: 'client_address' },
        { id: 'salesperson_name', label: 'Salesperson Name', key: 'salesperson_name' },
        { id: 'salesperson_email', label: 'Salesperson Email', key: 'salesperson_email' },
        { id: 'branch_name', label: 'Branch', key: 'branch_name' },
        { id: 'status', label: 'Status', key: 'status' },
        { id: 'service_type', label: 'Service Type', key: 'service_type' },
        { id: 'roof_condition', label: 'Roof Condition', key: 'roof_condition' },
        { id: 'system_condition', label: 'System Condition', key: 'system_condition' },
        { id: 'full_roof_inspection_interest', label: 'Roofing Interest', key: 'full_roof_inspection_interest' },
        { id: 'full_hvac_furnace_inspection_interest', label: 'HVAC Interest', key: 'full_hvac_furnace_inspection_interest' },
        { id: 'roof_notification_sent', label: 'Roof Notification Sent', key: 'roof_notification_sent' },
        { id: 'hvac_notification_sent', label: 'HVAC Notification Sent', key: 'hvac_notification_sent' },
        { id: 'attic_tech_created_at', label: 'Attic Tech Created', key: 'attic_tech_created_at' },
        { id: 'created_at', label: 'Report Created', key: 'created_at' },
    ];

    const handleColumnToggle = (columnId: string) => {
        setSelectedColumns(prev => 
            prev.includes(columnId) 
                ? prev.filter(id => id !== columnId)
                : [...prev, columnId]
        );
    };

    const handleSelectAll = () => {
        if (selectedColumns.length === availableColumns.length) {
            setSelectedColumns([]);
        } else {
            setSelectedColumns(availableColumns.map(col => col.id));
        }
    };

    const handleFilterChange = (field: string, value: string) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const formatValue = (value: any, columnId: string) => {
        if (value === null || value === undefined) return '';
        
        // Boolean values
        if (typeof value === 'boolean') {
            return value ? 'Yes' : 'No';
        }
        
        // Dates
        if (columnId.includes('created_at') || columnId.includes('date')) {
            if (!value) return '';
            const date = new Date(value);
            return date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        
        // Conditions (snake_case to Title Case)
        if (columnId.includes('condition') && typeof value === 'string') {
            return value.split('_').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ');
        }
        
        return value.toString();
    };

    const handleExport = async () => {
        if (selectedColumns.length === 0) {
            setError('Please select at least one column to export');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            // Fetch all data with filters (no pagination limit)
            const response = await inspectionReportService.getAll(1, 10000, filters);
            
            if (!response || !response.data || response.data.length === 0) {
                setError('No data to export with the selected filters');
                setLoading(false);
                return;
            }

            // Create workbook and worksheet
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Inspection Reports', {
                views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }] // Freeze header row
            });

            // Get column headers
            const headers = selectedColumns.map(columnId => {
                const column = availableColumns.find(col => col.id === columnId);
                return column?.label || columnId;
            });

            // Add header row with styling
            const headerRow = worksheet.addRow(headers);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF2E7D32' } // Green background
            };
            headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
            headerRow.height = 25;

            // Apply borders to header
            headerRow.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FF000000' } },
                    left: { style: 'thin', color: { argb: 'FF000000' } },
                    bottom: { style: 'thin', color: { argb: 'FF000000' } },
                    right: { style: 'thin', color: { argb: 'FF000000' } }
                };
            });

            // Add data rows
            response.data.forEach((report: any, index: number) => {
                const rowData = selectedColumns.map(columnId => {
                    const column = availableColumns.find(col => col.id === columnId);
                    if (column) {
                        return formatValue(report[column.key], column.key);
                    }
                    return '';
                });
                
                const dataRow = worksheet.addRow(rowData);
                
                // Alternate row colors
                const isEvenRow = (index + 2) % 2 === 0; // +2 because header is row 1
                if (isEvenRow) {
                    dataRow.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF5F5F5' } // Light gray
                    };
                }

                // Apply borders and alignment to all cells
                dataRow.eachCell((cell) => {
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
                        left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
                        bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
                        right: { style: 'thin', color: { argb: 'FFD3D3D3' } }
                    };
                    cell.alignment = { vertical: 'middle', wrapText: false };
                });
            });

            // Auto-fit columns based on content
            worksheet.columns.forEach((column, index) => {
                let maxLength = headers[index].length;
                
                worksheet.getColumn(index + 1).eachCell({ includeEmpty: false }, (cell) => {
                    const cellValue = cell.value ? String(cell.value) : '';
                    if (cellValue.length > maxLength) {
                        maxLength = cellValue.length;
                    }
                });
                
                column.width = Math.min(Math.max(maxLength + 2, 12), 50);
            });

            // Generate filename with timestamp
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `Inspection_Reports_${timestamp}.xlsx`;

            // Download file
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { 
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();
            window.URL.revokeObjectURL(url);

            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                onClose();
            }, 2000);
        } catch (err: any) {
            console.error('Export error:', err);
            setError(err.message || 'Failed to export data');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading) {
            onClose();
        }
    };

    return (
        <Dialog 
            open={open} 
            onClose={handleClose}
            maxWidth="md" 
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 2,
                    maxHeight: '90vh'
                }
            }}
        >
            <DialogTitle sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                pb: 2
            }}>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                        Export to Excel
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Select columns and apply filters to export your data
                    </Typography>
                </Box>
                <IconButton onClick={handleClose} size="small" disabled={loading}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            
            <Divider />
            
            <DialogContent sx={{ pt: 3 }}>
                {error && (
                    <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                        {error}
                    </Alert>
                )}

                {success && (
                    <Alert severity="success" sx={{ mb: 3 }} icon={<CheckCircleIcon />}>
                        File exported successfully!
                    </Alert>
                )}

                {/* Column Selection */}
                <Paper sx={{ p: 2.5, mb: 3, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                            Select Columns ({selectedColumns.length}/{availableColumns.length})
                        </Typography>
                        <Button 
                            size="small" 
                            onClick={handleSelectAll}
                            variant="outlined"
                        >
                            {selectedColumns.length === availableColumns.length ? 'Deselect All' : 'Select All'}
                        </Button>
                    </Box>
                    <Divider sx={{ mb: 2 }} />
                    <FormGroup>
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 1 }}>
                            {availableColumns.map((column) => (
                                <FormControlLabel
                                    key={column.id}
                                    control={
                                        <Checkbox 
                                            checked={selectedColumns.includes(column.id)}
                                            onChange={() => handleColumnToggle(column.id)}
                                            size="small"
                                        />
                                    }
                                    label={<Typography variant="body2">{column.label}</Typography>}
                                />
                            ))}
                        </Box>
                    </FormGroup>
                </Paper>

                {/* Filters */}
                <Paper sx={{ p: 2.5, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                        Filters (Optional)
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Branch</InputLabel>
                            <Select 
                                value={filters.branch_name} 
                                onChange={(e) => handleFilterChange('branch_name', e.target.value)} 
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
                        <FormControl fullWidth size="small">
                            <InputLabel>Salesperson</InputLabel>
                            <Select 
                                value={filters.salesperson_name} 
                                onChange={(e) => handleFilterChange('salesperson_name', e.target.value)} 
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
                        <FormControl fullWidth size="small">
                            <InputLabel>Status</InputLabel>
                            <Select 
                                value={filters.type} 
                                onChange={(e) => handleFilterChange('type', e.target.value)} 
                                label="Status"
                            >
                                <MenuItem value=""><em>All Status</em></MenuItem>
                                <MenuItem value="Lead & Opportunity">Lead & Opportunity</MenuItem>
                                <MenuItem value="Opportunity">Opportunity</MenuItem>
                                <MenuItem value="Lead">Lead</MenuItem>
                                <MenuItem value="Report">Report</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl fullWidth size="small">
                            <InputLabel>Service Type</InputLabel>
                            <Select 
                                value={filters.service_type} 
                                onChange={(e) => handleFilterChange('service_type', e.target.value)} 
                                label="Service Type"
                            >
                                <MenuItem value=""><em>All Services</em></MenuItem>
                                <MenuItem value="Both">Both</MenuItem>
                                <MenuItem value="Roofing">Roofing</MenuItem>
                                <MenuItem value="HVAC">HVAC</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mt: 2 }}>
                        <TextField 
                            fullWidth
                            size="small"
                            type="date" 
                            value={filters.startDate} 
                            onChange={(e) => handleFilterChange('startDate', e.target.value)} 
                            InputLabelProps={{ shrink: true }} 
                            label="From Date"
                        />
                        <TextField 
                            fullWidth
                            size="small"
                            type="date" 
                            value={filters.endDate} 
                            onChange={(e) => handleFilterChange('endDate', e.target.value)} 
                            InputLabelProps={{ shrink: true }} 
                            label="To Date"
                        />
                    </Box>
                    {Object.values(filters).some(v => v !== '') && (
                        <Box sx={{ mt: 2 }}>
                            <Button 
                                size="small" 
                                onClick={() => setFilters({
                                    startDate: '',
                                    endDate: '',
                                    branch_name: '',
                                    salesperson_name: '',
                                    type: '',
                                    service_type: '',
                                })}
                            >
                                Clear Filters
                            </Button>
                        </Box>
                    )}
                </Paper>
            </DialogContent>
            
            <Divider />
            
            <DialogActions sx={{ p: 2.5, gap: 1 }}>
                <Button 
                    onClick={handleClose} 
                    variant="outlined"
                    disabled={loading}
                    sx={{ minWidth: 100 }}
                >
                    Cancel
                </Button>
                <Button 
                    variant="contained" 
                    startIcon={loading ? null : <DownloadIcon />}
                    onClick={handleExport}
                    disabled={loading || selectedColumns.length === 0}
                    sx={{ minWidth: 150 }}
                >
                    {loading ? 'Exporting...' : 'Export to Excel'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ExportToExcelModal;

