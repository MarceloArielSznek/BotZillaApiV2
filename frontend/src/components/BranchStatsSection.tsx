import React from 'react';
import { 
    Card, 
    CardContent, 
    Typography, 
    Box,
    Chip,
    Avatar,
    Paper,
    Stack,
    CircularProgress
} from '@mui/material';
import { 
    Business as BranchIcon,
    LocationOn as LocationIcon
} from '@mui/icons-material';
import { InspectionReportsStats } from '../services/inspectionReportService';

interface BranchStatsSectionProps {
    stats: InspectionReportsStats | null;
    loading: boolean;
}

const BranchStatsSection: React.FC<BranchStatsSectionProps> = ({ stats, loading }) => {
    if (loading || !stats) {
        return (
            <Card sx={{ borderRadius: 3, width: '100%', mb: 4 }}>
                <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                        <CircularProgress />
                    </Box>
                </CardContent>
            </Card>
        );
    }

    const { byBranch } = stats;

    return (
        <Card sx={{ borderRadius: 3, width: '100%', mb: 4 }}>
            <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <BranchIcon sx={{ mr: 1, color: '#2196F3' }} />
                    <Typography variant="h6" fontWeight={600}>
                        Reports by Branch
                    </Typography>
                </Box>
                <Box sx={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: 2,
                    width: '100%',
                }}>
                    {byBranch.map((branchStat, index) => (
                        <Box key={index} sx={{ flex: '1 1 280px', minWidth: '280px' }}>
                            <Paper
                                sx={{
                                    p: 2,
                                    borderRadius: 2,
                                    background: 'linear-gradient(135deg, #2196F315 0%, #2196F305 100%)',
                                    border: '1px solid #2196F330',
                                    height: '100%'
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <Avatar sx={{ bgcolor: '#2196F3', mr: 2, width: 32, height: 32 }}>
                                        <LocationIcon sx={{ fontSize: 18 }} />
                                    </Avatar>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                        {branchStat.branch}
                                    </Typography>
                                </Box>
                                <Stack spacing={1}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Typography variant="body2" color="text.secondary">
                                            Total Reports
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            {branchStat.total}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Typography variant="body2" color="text.secondary">
                                            Leads
                                        </Typography>
                                        <Chip 
                                            label={branchStat.leads} 
                                            size="small" 
                                            color="success"
                                            sx={{ height: 20, fontSize: '0.75rem' }}
                                        />
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Typography variant="body2" color="text.secondary">
                                            Conversion Rate
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#4CAF50' }}>
                                            {branchStat.conversionRate}%
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', gap: 2, mt: 1, pt: 1, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                                        <Box sx={{ flex: 1 }}>
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                🏠 Roof
                                            </Typography>
                                            <Typography variant="body2" fontWeight={600}>
                                                {branchStat.roofingLeads}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ flex: 1 }}>
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                ❄️ HVAC
                                            </Typography>
                                            <Typography variant="body2" fontWeight={600}>
                                                {branchStat.hvacLeads}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ flex: 1 }}>
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                ⚡ Opp
                                            </Typography>
                                            <Typography variant="body2" fontWeight={600}>
                                                {branchStat.opportunities}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Stack>
                            </Paper>
                        </Box>
                    ))}
                </Box>
            </CardContent>
        </Card>
    );
};

export default BranchStatsSection;

