import React from 'react';
import { Box, Card, CardContent, Typography, List, ListItem, ListItemText, CircularProgress, Alert, Stack, IconButton, Tooltip, alpha } from '@mui/material';
import { Notifications as NotificationsIcon, CalendarToday as CalendarIcon, PeopleAlt as PeopleAltIcon, Warning as WarningIcon, CheckCircleOutline as CheckCircleIcon, TrendingUp as TrendingUpIcon, ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { type DashboardStats, type Notification } from '../../services/notificationService';
import type { SvgIconProps } from '@mui/material';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ReactElement;
    iconBgColor: string;
    trend?: {
        value: string;
        isPositive: boolean;
    };
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, iconBgColor, trend }) => (
    <Card sx={{ 
        height: '100%',
        backgroundColor: 'rgba(30, 30, 30, 0.6)', 
        backdropFilter: 'blur(10px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        borderRadius: 3,
        border: '1px solid rgba(255, 255, 255, 0.05)',
        transition: 'all 0.3s ease',
        '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.2)',
            borderColor: alpha(iconBgColor, 0.3),
        }
    }}>
        <CardContent sx={{ height: '100%', p: 3, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                <Box sx={{ 
                    width: 48, 
                    height: 48, 
                    borderRadius: 2,
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    backgroundColor: alpha(iconBgColor, 0.15),
                    color: iconBgColor,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                        backgroundColor: iconBgColor,
                        color: 'white',
                        transform: 'scale(1.1)'
                    }
                }}>
                    {React.cloneElement(icon, { sx: { fontSize: 24 } } as SvgIconProps)}
                </Box>
                {trend && (
                    <Typography 
                        variant="caption" 
                        sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            color: trend.isPositive ? '#4CAF50' : '#F44336',
                            backgroundColor: trend.isPositive ? alpha('#4CAF50', 0.1) : alpha('#F44336', 0.1),
                            px: 1.5,
                            py: 0.5,
                            borderRadius: 2,
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            transition: 'all 0.3s ease',
                            '&:hover': {
                                backgroundColor: trend.isPositive ? alpha('#4CAF50', 0.2) : alpha('#F44336', 0.2),
                            }
                        }}
                    >
                        <TrendingUpIcon sx={{ 
                            fontSize: 16, 
                            mr: 0.5, 
                            transform: trend.isPositive ? 'none' : 'rotate(180deg)',
                            transition: 'transform 0.3s ease'
                        }} />
                        {trend.value}
                    </Typography>
                )}
            </Box>
            <Box>
                <Typography variant="h3" sx={{ 
                    fontWeight: 700, 
                    mb: 1, 
                    color: 'common.white',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                        color: iconBgColor
                    }
                }}>
                    {value}
                </Typography>
                <Typography variant="body2" sx={{ 
                    color: 'text.secondary', 
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                }}>
                    {title}
                </Typography>
            </Box>
        </CardContent>
    </Card>
);

interface WarningCardProps {
    title: string;
    warnings: any[];
    icon: React.ReactElement;
    iconColor: string;
    maxItems?: number;
}

const WarningCard: React.FC<WarningCardProps> = ({ title, warnings, icon, iconColor, maxItems = 5 }) => {
    const [showAll, setShowAll] = React.useState(false);
    const displayWarnings = showAll ? warnings : warnings.slice(0, maxItems);

    return (
        <Card sx={{ 
            height: '100%', 
            backgroundColor: 'rgba(30, 30, 30, 0.6)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            borderRadius: 3,
            border: '1px solid rgba(255, 255, 255, 0.05)',
            transition: 'all 0.3s ease',
            '&:hover': {
                boxShadow: '0 12px 40px rgba(0, 0, 0, 0.2)',
                borderColor: alpha(iconColor, 0.3),
            }
        }}>
            <CardContent sx={{ height: '100%', p: 3 }}>
                <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    mb: 3 
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box sx={{ 
                            width: 40, 
                            height: 40, 
                            borderRadius: 2,
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            backgroundColor: alpha(iconColor, 0.15),
                            color: iconColor,
                            mr: 2,
                            transition: 'all 0.3s ease',
                            '&:hover': {
                                backgroundColor: iconColor,
                                color: 'white',
                                transform: 'scale(1.1)'
                            }
                        }}>
                            {React.cloneElement(icon, { sx: { fontSize: 24 } } as SvgIconProps)}
                        </Box>
                        <Typography variant="h6" sx={{ 
                            fontWeight: 600, 
                            color: 'common.white',
                            transition: 'color 0.3s ease',
                            '&:hover': {
                                color: iconColor
                            }
                        }}>
                            {title}
                        </Typography>
                    </Box>
                    {warnings.length > maxItems && (
                        <Tooltip title={showAll ? "Show less" : "View all"}>
                            <IconButton 
                                size="small" 
                                onClick={() => setShowAll(!showAll)}
                                sx={{ 
                                    color: iconColor,
                                    backgroundColor: alpha(iconColor, 0.1),
                                    '&:hover': {
                                        backgroundColor: alpha(iconColor, 0.2),
                                    }
                                }}
                            >
                                <ArrowForwardIcon sx={{ 
                                    transform: showAll ? 'rotate(90deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.3s ease'
                                }} />
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>

                {warnings.length === 0 ? (
                    <Box sx={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        backgroundColor: alpha('#1E1E1E', 0.4),
                        borderRadius: 3,
                        p: 4,
                        transition: 'all 0.3s ease',
                        '&:hover': {
                            backgroundColor: alpha('#1E1E1E', 0.6),
                            transform: 'scale(1.02)'
                        }
                    }}>
                        <CheckCircleIcon sx={{ 
                            fontSize: 48, 
                            color: '#4CAF50', 
                            mb: 2,
                            transition: 'transform 0.3s ease',
                            '&:hover': {
                                transform: 'scale(1.1)'
                            }
                        }} />
                        <Typography sx={{ 
                            color: 'text.secondary', 
                            textAlign: 'center',
                            fontWeight: 500
                        }}>
                            All clear! No recent warnings found.
                        </Typography>
                    </Box>
                ) : (
                    <Stack spacing={2}>
                        {displayWarnings.map((warning) => (
                            <Card key={warning.id} sx={{ 
                                backgroundColor: alpha('#1E1E1E', 0.4),
                                borderRadius: 2,
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                    backgroundColor: alpha('#1E1E1E', 0.6),
                                    transform: 'translateX(8px)'
                                }
                            }}>
                                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                    <Typography variant="subtitle1" sx={{ 
                                        fontWeight: 600, 
                                        color: 'common.white',
                                        mb: 1
                                    }}>
                                        {warning.salesPersonRecipient?.name || 'Unknown User'}
                                    </Typography>
                                    <Typography variant="caption" sx={{ 
                                        color: 'text.secondary',
                                        display: 'block',
                                        mb: 1
                                    }}>
                                        {warning.message || 'No message'}
                                    </Typography>
                                    <Typography variant="caption" sx={{ 
                                        color: 'text.secondary',
                                        backgroundColor: alpha('#1E1E1E', 0.3),
                                        px: 1.5,
                                        py: 0.5,
                                        borderRadius: 1,
                                        display: 'inline-block'
                                    }}>
                                        {format(parseISO(warning.created_at), "MMM d, yyyy HH:mm")}
                                    </Typography>
                                </CardContent>
                            </Card>
                        ))}
                    </Stack>
                )}
            </CardContent>
        </Card>
    );
};

interface NotificationDashboardProps {
    stats: DashboardStats | null;
    loading: boolean;
    error: string | null;
}

const NotificationDashboard: React.FC<NotificationDashboardProps> = ({ stats, loading, error }) => {
    if (loading) return (
        <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100vh',
            backgroundColor: alpha('#1E1E1E', 0.4),
            borderRadius: 3
        }}>
            <CircularProgress sx={{ color: '#4CAF50' }} />
        </Box>
    );
    
    if (error) return (
        <Alert 
            severity="error" 
            sx={{ 
                m: 3, 
                backgroundColor: alpha('#F44336', 0.1),
                color: '#F44336',
                border: '1px solid ' + alpha('#F44336', 0.2),
                borderRadius: 2
            }}
        >
            {error}
        </Alert>
    );
    
    if (!stats) return (
        <Alert 
            severity="info" 
            sx={{ 
                m: 3, 
                backgroundColor: alpha('#2196F3', 0.1),
                color: '#2196F3',
                border: '1px solid ' + alpha('#2196F3', 0.2),
                borderRadius: 2
            }}
        >
            No statistics available.
        </Alert>
    );

    const { sentToday, sentThisWeek, salespersonsOverLimit, recentWarnings } = stats;

    return (
        <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
            <Box sx={{ 
                display: 'grid',
                gap: 3,
                gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(2, 1fr)',
                    md: 'repeat(3, 1fr)'
                }
            }}>
                <StatCard 
                    title="Sent Today" 
                    value={sentToday} 
                    icon={<NotificationsIcon />} 
                    iconBgColor="#4CAF50"
                    trend={{ value: '+12% this week', isPositive: true }}
                />
                <StatCard 
                    title="Sent This Week" 
                    value={sentThisWeek} 
                    icon={<CalendarIcon />} 
                    iconBgColor="#2196F3"
                    trend={{ value: '+5% this month', isPositive: true }}
                />
                <StatCard 
                    title="Salespersons Over Limit" 
                    value={salespersonsOverLimit.length} 
                    icon={<PeopleAltIcon />} 
                    iconBgColor="#F44336"
                    trend={{ value: '-2% this week', isPositive: false }}
                />
            </Box>

            <Box sx={{ 
                display: 'grid',
                gap: 3,
                gridTemplateColumns: {
                    xs: '1fr',
                    md: 'repeat(2, 1fr)'
                },
                mt: 3
            }}>
                <WarningCard 
                    title="Recent Warnings" 
                    warnings={recentWarnings}
                    icon={<WarningIcon />}
                    iconColor="#FFC107"
                />
                <WarningCard 
                    title="Salespersons Over Limit" 
                    warnings={salespersonsOverLimit.map(sp => ({
                        id: sp.id,
                        salesPersonRecipient: { name: sp.name },
                        message: `Active Leads: ${sp.activeLeadsCount}`,
                        created_at: new Date().toISOString()
                    }))}
                    icon={<PeopleAltIcon />}
                    iconColor="#F44336"
                />
            </Box>
        </Box>
    );
};

export default NotificationDashboard; 