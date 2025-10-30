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
    Work as WorkIcon,
    Warning as WarningIcon,
    Assignment as AssignmentIcon
} from '@mui/icons-material';
import type { Job } from '../../interfaces';

interface JobsStatsCardsProps {
    jobs: Job[];
    totalJobs: number;
    loading: boolean;
}

const JobsStatsCards: React.FC<JobsStatsCardsProps> = ({ jobs, totalJobs, loading }) => {
    if (loading) {
        return (
            <Box sx={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: 3, 
                mb: 4,
                width: '100%',
            }}>
                {[1, 2, 3].map((i) => (
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

    // Calcular estadísticas

    // 1. Total Jobs - breakdown por estado (top 3)
    const statusCounts: { [key: string]: number } = {};
    jobs.forEach((job: Job) => {
        const statusName = job.status?.name || 'Unknown';
        statusCounts[statusName] = (statusCounts[statusName] || 0) + 1;
    });
    const topStatuses = Object.entries(statusCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3);

    // 2. Overrun Jobs - breakdown por branch (top 3)
    const jobsWithOverrun = jobs.filter((job: any) => job.is_overrun);
    const overrunByBranch: { [key: string]: number } = {};
    jobsWithOverrun.forEach((job: any) => {
        const branchName = job.branch?.name || 'Unknown';
        overrunByBranch[branchName] = (overrunByBranch[branchName] || 0) + 1;
    });
    const topOverrunBranches = Object.entries(overrunByBranch)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3);

    // 3. In Payload - % de closed jobs que están marcados in_payload
    const closedJobs = jobs.filter((job: any) => 
        job.status?.name?.toLowerCase().includes('closed')
    );
    const closedJobsInPayload = closedJobs.filter((job: any) => job.in_payload);
    const inPayloadPercentage = closedJobs.length > 0 
        ? ((closedJobsInPayload.length / closedJobs.length) * 100).toFixed(1)
        : '0.0';

    const cards = [
        {
            title: 'Total Jobs',
            value: totalJobs,
            icon: <WorkIcon />,
            color: '#667eea',
            subtitle: 'All jobs in system',
            details: topStatuses.length > 0 ? {
                items: topStatuses.map(([status, count]) => ({
                    icon: status.toLowerCase().includes('closed') ? '✅' : 
                          status.toLowerCase().includes('payload') ? '📦' :
                          status.toLowerCase().includes('upload') ? '📤' : '📋',
                    label: status,
                    value: count,
                    subtext: `${totalJobs > 0 ? ((count / totalJobs) * 100).toFixed(1) : 0}% of total`
                }))
            } : null
        },
        {
            title: 'Overrun Jobs',
            value: jobsWithOverrun.length,
            subtitle: `${totalJobs > 0 ? ((jobsWithOverrun.length / totalJobs) * 100).toFixed(1) : 0}% of total`,
            icon: <WarningIcon />,
            color: '#f5576c',
            details: topOverrunBranches.length > 0 ? {
                items: topOverrunBranches.map(([branch, count]) => ({
                    icon: '🏢',
                    label: branch,
                    value: count,
                    subtext: `${jobsWithOverrun.length > 0 ? ((count / jobsWithOverrun.length) * 100).toFixed(1) : 0}% of overrun`
                }))
            } : null
        },
        {
            title: 'In Payload',
            value: closedJobsInPayload.length,
            subtitle: `${inPayloadPercentage}% of closed jobs`,
            icon: <AssignmentIcon />,
            color: '#4facfe',
            details: closedJobs.length > 0 ? {
                items: [
                    {
                        icon: '✅',
                        label: 'Closed Jobs',
                        value: closedJobs.length,
                        subtext: 'Total closed jobs'
                    },
                    {
                        icon: '📦',
                        label: 'In Payload',
                        value: closedJobsInPayload.length,
                        subtext: `${inPayloadPercentage}% marked`
                    }
                ]
            } : null
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
                                    {React.cloneElement(card.icon, { sx: { fontSize: 24, color: 'white' } })}
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

export default JobsStatsCards;

