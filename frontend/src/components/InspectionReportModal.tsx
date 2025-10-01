import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    Divider,
    Chip,
    IconButton,
    Paper,
} from '@mui/material';
import { 
    Close as CloseIcon, 
    OpenInNew as OpenInNewIcon,
    CheckCircle as CheckCircleIcon,
    Cancel as CancelIcon,
    Person as PersonIcon,
    Business as BusinessIcon,
    Email as EmailIcon,
    Phone as PhoneIcon,
    LocationOn as LocationOnIcon,
    TrendingUp as TrendingUpIcon,
    Warning as WarningIcon,
    Notifications as NotificationsIcon,
    CalendarToday as CalendarIcon
} from '@mui/icons-material';
import { InspectionReport } from '../services/inspectionReportService';

interface InspectionReportModalProps {
    open: boolean;
    onClose: () => void;
    report: InspectionReport | null;
}

const InspectionReportModal: React.FC<InspectionReportModalProps> = ({ open, onClose, report }) => {
    if (!report) return null;

    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Lead & Opportunity':
                return 'warning';
            case 'Opportunity':
                return 'error';
            case 'Lead':
                return 'success';
            default:
                return 'default';
        }
    };

    const InfoRow = ({ label, value, icon }: { label: string; value: any; icon?: React.ReactNode }) => (
        <Box sx={{ mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                {icon && (
                    <Box sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
                        {icon}
                    </Box>
                )}
                <Typography variant="caption" color="text.secondary">
                    {label}
                </Typography>
            </Box>
            <Typography variant="body2" color="text.primary" sx={{ pl: icon ? 2.5 : 0 }}>
                {value || 'N/A'}
            </Typography>
        </Box>
    );

    const formatCondition = (condition: string) => {
        if (!condition) return 'Not specified';
        // Convert snake_case to Title Case
        return condition
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    };

    return (
        <Dialog 
            open={open} 
            onClose={onClose} 
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
                        Inspection Report Details
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {report.estimate_name}
                    </Typography>
                </Box>
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            
            <Divider />
            
            <DialogContent sx={{ pt: 3 }}>
                {/* Status Summary */}
                <Paper sx={{ p: 2.5, mb: 3, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2 }}>
                        <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                Status
                            </Typography>
                            <Chip 
                                label={report.status} 
                                color={getStatusColor(report.status)}
                                sx={{ fontWeight: 600 }}
                            />
                        </Box>
                        <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                Service Type
                            </Typography>
                            <Chip 
                                label={report.service_type} 
                                variant="outlined"
                                color={report.service_type === 'Both' ? 'secondary' : 'default'}
                                sx={{ fontWeight: 600 }}
                            />
                        </Box>
                        <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                Branch
                            </Typography>
                            <Chip 
                                icon={<BusinessIcon sx={{ fontSize: 16 }} />}
                                label={report.branch_name || 'Unknown'} 
                                variant="outlined"
                            />
                        </Box>
                    </Box>
                </Paper>

                {/* Customer Information */}
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PersonIcon /> Customer Information
                </Typography>
                <Paper sx={{ p: 2.5, mb: 3, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                        <InfoRow label="Name" value={report.client_name} icon={<PersonIcon fontSize="small" />} />
                        <InfoRow label="Phone" value={report.client_phone} icon={<PhoneIcon fontSize="small" />} />
                        <InfoRow label="Email" value={report.client_email} icon={<EmailIcon fontSize="small" />} />
                        <InfoRow label="Address" value={report.client_address} icon={<LocationOnIcon fontSize="small" />} />
                    </Box>
                </Paper>

                {/* Salesperson Information */}
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BusinessIcon /> Salesperson Information
                </Typography>
                <Paper sx={{ p: 2.5, mb: 3, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                        <InfoRow label="Name" value={report.salesperson_name} icon={<PersonIcon fontSize="small" />} />
                        <InfoRow label="Email" value={report.salesperson_email} icon={<EmailIcon fontSize="small" />} />
                    </Box>
                </Paper>

                {/* Lead Information */}
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TrendingUpIcon /> Lead Information
                </Typography>
                <Paper sx={{ p: 2.5, mb: 3, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                        {report.full_roof_inspection_interest && (
                            <Box sx={{ 
                                p: 2, 
                                borderRadius: 2, 
                                bgcolor: 'rgba(46, 125, 50, 0.15)',
                                border: '1px solid',
                                borderColor: 'success.main',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 2
                            }}>
                                <CheckCircleIcon color="success" sx={{ fontSize: 32 }} />
                                <Box>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                        Roofing Lead
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Full inspection requested
                                    </Typography>
                                </Box>
                            </Box>
                        )}
                        {report.full_hvac_furnace_inspection_interest && (
                            <Box sx={{ 
                                p: 2, 
                                borderRadius: 2, 
                                bgcolor: 'rgba(46, 125, 50, 0.15)',
                                border: '1px solid',
                                borderColor: 'success.main',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 2
                            }}>
                                <CheckCircleIcon color="success" sx={{ fontSize: 32 }} />
                                <Box>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                        HVAC Lead
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Full inspection requested
                                    </Typography>
                                </Box>
                            </Box>
                        )}
                        {!report.full_roof_inspection_interest && !report.full_hvac_furnace_inspection_interest && (
                            <Box sx={{ p: 2, textAlign: 'center', gridColumn: '1 / -1' }}>
                                <Typography variant="body2" color="text.secondary">
                                    No inspection interests recorded
                                </Typography>
                            </Box>
                        )}
                    </Box>
                </Paper>

                {/* Opportunity Information */}
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WarningIcon /> Opportunity Information
                </Typography>
                <Paper sx={{ p: 2.5, mb: 3, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                        {report.roof_condition === 'needs_replacement' && (
                            <Box sx={{ 
                                p: 2, 
                                borderRadius: 2, 
                                bgcolor: 'rgba(211, 47, 47, 0.15)',
                                border: '1px solid',
                                borderColor: 'error.main',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 2
                            }}>
                                <WarningIcon color="error" sx={{ fontSize: 32 }} />
                                <Box>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                        Roofing Opportunity
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {formatCondition(report.roof_condition)}
                                    </Typography>
                                </Box>
                            </Box>
                        )}
                        {report.system_condition === 'needs_replacement' && (
                            <Box sx={{ 
                                p: 2, 
                                borderRadius: 2, 
                                bgcolor: 'rgba(211, 47, 47, 0.15)',
                                border: '1px solid',
                                borderColor: 'error.main',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 2
                            }}>
                                <WarningIcon color="error" sx={{ fontSize: 32 }} />
                                <Box>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                        HVAC Opportunity
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {formatCondition(report.system_condition)}
                                    </Typography>
                                </Box>
                            </Box>
                        )}
                        {report.roof_condition !== 'needs_replacement' && report.system_condition !== 'needs_replacement' && (
                            <Box sx={{ p: 2, textAlign: 'center', gridColumn: '1 / -1' }}>
                                <Typography variant="body2" color="text.secondary">
                                    No opportunities identified
                                </Typography>
                            </Box>
                        )}
                    </Box>
                </Paper>

                {/* Notifications Sent */}
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <NotificationsIcon /> Notifications Sent
                </Typography>
                <Paper sx={{ p: 2.5, mb: 3, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                        <Box sx={{ 
                            p: 2, 
                            borderRadius: 2, 
                            bgcolor: 'background.default',
                            border: '1px solid',
                            borderColor: 'divider',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                    Roofing Notification
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {report.roof_notification_sent ? 'Notification sent' : 'Not sent yet'}
                                </Typography>
                            </Box>
                            <Chip 
                                label={report.roof_notification_sent ? 'Sent' : 'Pending'} 
                                size="small"
                                color={report.roof_notification_sent ? 'primary' : 'default'}
                                variant={report.roof_notification_sent ? 'filled' : 'outlined'}
                            />
                        </Box>
                        <Box sx={{ 
                            p: 2, 
                            borderRadius: 2, 
                            bgcolor: 'background.default',
                            border: '1px solid',
                            borderColor: 'divider',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                    HVAC Notification
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {report.hvac_notification_sent ? 'Notification sent' : 'Not sent yet'}
                                </Typography>
                            </Box>
                            <Chip 
                                label={report.hvac_notification_sent ? 'Sent' : 'Pending'} 
                                size="small"
                                color={report.hvac_notification_sent ? 'primary' : 'default'}
                                variant={report.hvac_notification_sent ? 'filled' : 'outlined'}
                            />
                        </Box>
                    </Box>
                </Paper>

                {/* Dates */}
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CalendarIcon /> Timeline
                </Typography>
                <Paper sx={{ p: 2.5, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                        <InfoRow 
                            label="Attic Tech Created" 
                            value={formatDate(report.attic_tech_created_at)} 
                            icon={<CalendarIcon fontSize="small" />}
                        />
                        <InfoRow 
                            label="Report Created" 
                            value={formatDate(report.created_at)} 
                            icon={<CalendarIcon fontSize="small" />}
                        />
                    </Box>
                </Paper>
            </DialogContent>
            
            <Divider />
            
            <DialogActions sx={{ p: 2.5, gap: 1 }}>
                <Button 
                    onClick={onClose} 
                    variant="outlined"
                    sx={{ minWidth: 100 }}
                >
                    Close
                </Button>
                <Button 
                    variant="contained" 
                    endIcon={<OpenInNewIcon />}
                    onClick={() => window.open(report.estimate_link, '_blank')}
                    sx={{ minWidth: 150 }}
                >
                    Jump to Report
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default InspectionReportModal;

