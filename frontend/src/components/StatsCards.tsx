import React from 'react';
import { 
    Card, 
    CardContent, 
    Typography, 
    Box,
    Avatar,
    CircularProgress
} from '@mui/material';
import { 
    Assessment as AssessmentIcon,
    TrendingUp as TrendingUpIcon,
    Roofing as RoofingIcon,
    AcUnit as HvacIcon,
    Notifications as NotificationsIcon
} from '@mui/icons-material';
import { InspectionReportsStats } from '../services/inspectionReportService';

interface StatsCardsProps {
    stats: InspectionReportsStats | null;
    loading: boolean;
}

const StatsCards: React.FC<StatsCardsProps> = ({ stats, loading }) => {
    if (loading || !stats) {
        return (
            <Box sx={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: 3, 
                mb: 4,
                width: '100%',
            }}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Box key={i} sx={{ flex: '1 1 280px', minWidth: '280px', maxWidth: '380px' }}>
                        <Card sx={{ height: '100%', borderRadius: 3 }}>
                            <CardContent sx={{ p: 3 }}>
                                <CircularProgress size={24} />
                            </CardContent>
                        </Card>
                    </Box>
                ))}
            </Box>
        );
    }

    const { overall, byBranch } = stats;

    const cards = [
        {
            title: 'Total Reports',
            value: overall.totalReports,
            icon: <AssessmentIcon />,
            color: '#4CAF50',
            subtitle: 'All inspection reports',
            details: null
        },
        {
            title: 'Total Leads',
            value: overall.totalLeads,
            subtitle: `${overall.overallConversionRate}% conversion rate`,
            icon: <TrendingUpIcon />,
            color: '#2196F3',
            details: {
                items: [
                    { icon: '🏠', label: 'Roofing', value: overall.roofingLeads, subtext: `${overall.roofNotificationsSent} notifications sent` },
                    { icon: '❄️', label: 'HVAC', value: overall.hvacLeads, subtext: `${overall.hvacNotificationsSent} notifications sent` }
                ]
            }
        },
        {
            title: 'Total Opportunities',
            value: overall.totalOpportunities,
            subtitle: 'High-priority leads',
            icon: <RoofingIcon />,
            color: '#F44336',
            details: {
                items: [
                    { icon: '🏠', label: 'Roofing', value: overall.roofOpportunities, subtext: 'Roof needs replacement' },
                    { icon: '❄️', label: 'HVAC', value: overall.hvacOpportunities, subtext: 'System needs replacement' }
                ]
            }
        },
    ];

    return (
        <Box sx={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: 3, 
            mb: 4,
            width: '100%',
        }}>
            {cards.map((card, index) => (
                <Box key={index} sx={{ flex: '1 1 300px', minWidth: '300px' }}>
                        <Card
                            sx={{
                                height: '100%',
                                background: `linear-gradient(135deg, ${card.color}15 0%, ${card.color}05 100%)`,
                                border: `1px solid ${card.color}30`,
                                borderRadius: 3,
                                transition: 'all 0.3s ease-in-out',
                                '&:hover': {
                                    transform: 'translateY(-4px)',
                                    boxShadow: `0 8px 25px ${card.color}20`,
                                    borderColor: `${card.color}50`,
                                },
                            }}
                        >
                            <CardContent sx={{ p: 2.5 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                                    <Avatar sx={{ bgcolor: card.color, width: 48, height: 48 }}>
                                        {React.cloneElement(card.icon, { sx: { fontSize: 24 } })}
                                    </Avatar>
                                    <Box sx={{ flex: 1 }}>
                                        <Typography variant="h4" sx={{ fontWeight: 700, color: card.color }}>
                                            {card.value}
                                        </Typography>
                                        <Typography variant="subtitle1" color="text.primary" sx={{ fontWeight: 600 }}>
                                            {card.title}
                                        </Typography>
                                        {card.subtitle && (
                                            <Typography variant="caption" color="text.secondary">
                                                {card.subtitle}
                                            </Typography>
                                        )}
                                    </Box>
                                </Box>
                                {card.details && card.details.items && (
                                    <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                                        {card.details.items.map((item: any, idx: number) => (
                                            <Box key={idx} sx={{ mb: idx < card.details.items.length - 1 ? 1 : 0 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.25 }}>
                                                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                                                        {item.icon} {item.label}
                                                    </Typography>
                                                    <Typography variant="h6" fontWeight={700} color={card.color} sx={{ fontSize: '1.1rem' }}>
                                                        {item.value}
                                                    </Typography>
                                                </Box>
                                                {item.subtext && (
                                                    <Typography variant="caption" color="text.secondary" sx={{ pl: 2.5, fontSize: '0.75rem' }}>
                                                        {item.subtext}
                                                    </Typography>
                                                )}
                                            </Box>
                                        ))}
                                    </Box>
                                )}
                            </CardContent>
                        </Card>
                </Box>
            ))}
        </Box>
    );
};

export default StatsCards;

