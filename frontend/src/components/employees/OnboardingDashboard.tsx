import React, { useState, useEffect } from 'react';
import {
    Box, Card, CardContent, Typography, Button, CircularProgress, Alert, Chip
} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import PeopleIcon from '@mui/icons-material/People';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import atticTechSyncService, { EmployeeStats } from '@/services/atticTechSyncService';
import employeeService from '@/services/employeeService';
import StorageIcon from '@mui/icons-material/Storage';

interface OnboardingDashboardProps {
    onSyncComplete?: () => void;
}

const OnboardingDashboard: React.FC<OnboardingDashboardProps> = ({ onSyncComplete }) => {
    const [stats, setStats] = useState<EmployeeStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [syncingLegacy, setSyncingLegacy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [syncResult, setSyncResult] = useState<string | null>(null);
    const [legacySyncResult, setLegacySyncResult] = useState<string | null>(null);

    const loadStats = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await atticTechSyncService.getEmployeeStats();
            setStats(data);
        } catch (err: any) {
            setError('Failed to load statistics');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStats();
    }, []);

    const handleSync = async () => {
        setSyncing(true);
        setError(null);
        setSyncResult(null);
        
        try {
            const result = await atticTechSyncService.syncUsersFromAtticTech();
            setSyncResult(
                `✅ Sync completed: ${result.new_employees} new, ${result.updated_employees} updated, ${result.skipped} skipped`
            );
            
            // Recargar estadísticas
            await loadStats();
            
            // Notificar al componente padre
            if (onSyncComplete) {
                onSyncComplete();
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to sync with Attic Tech');
        } finally {
            setSyncing(false);
        }
    };

    const handleLegacySync = async () => {
        setSyncingLegacy(true);
        setError(null);
        setLegacySyncResult(null);
        
        try {
            const result = await employeeService.syncLegacyRecords();
            const { salesPersons, crewMembers } = result.data;
            
            const totalCopied = salesPersons.telegram_id_copied + crewMembers.telegram_id_copied;
            
            setLegacySyncResult(
                `✅ Legacy sync completed: ${salesPersons.synced} salespersons and ${crewMembers.synced} crew members linked. ` +
                `Created ${salesPersons.created + crewMembers.created} new employee records. ` +
                (totalCopied > 0 ? `Activated ${totalCopied} employees with existing Telegram IDs.` : '')
            );
            
            // Recargar estadísticas
            await loadStats();
            
            // Notificar al componente padre
            if (onSyncComplete) {
                onSyncComplete();
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to sync legacy records');
        } finally {
            setSyncingLegacy(false);
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!stats) {
        return (
            <Alert severity="error" sx={{ mb: 3 }}>
                Failed to load employee statistics
            </Alert>
        );
    }

    const statCards = [
        {
            title: 'Total Employees',
            value: stats.total,
            icon: <PeopleIcon sx={{ fontSize: 40 }} />,
            color: '#2196F3',
            subtitle: `${stats.from_attic_tech} from AT, ${stats.manual} manual`
        },
        {
            title: 'Ready to Activate',
            value: stats.pending_ready_to_activate,
            icon: <PersonAddIcon sx={{ fontSize: 40 }} />,
            color: '#9C27B0',
            subtitle: 'Completed registration'
        },
        {
            title: 'Awaiting Registration',
            value: stats.pending_awaiting_registration,
            icon: <HourglassEmptyIcon sx={{ fontSize: 40 }} />,
            color: '#FF9800',
            subtitle: 'Need to complete form'
        },
        {
            title: 'Active',
            value: stats.active,
            icon: <CheckCircleIcon sx={{ fontSize: 40 }} />,
            color: '#4CAF50',
            subtitle: 'Currently working'
        }
    ];

    return (
        <Box sx={{ mb: 4 }}>
            {/* Mensajes */}
            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}
            
            {syncResult && (
                <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSyncResult(null)}>
                    {syncResult}
                </Alert>
            )}

            {legacySyncResult && (
                <Alert severity="success" sx={{ mb: 2 }} onClose={() => setLegacySyncResult(null)}>
                    {legacySyncResult}
                </Alert>
            )}

            {/* Estadísticas */}
            <Box 
                sx={{ 
                    display: 'grid',
                    gridTemplateColumns: {
                        xs: '1fr',
                        sm: 'repeat(2, 1fr)',
                        md: 'repeat(4, 1fr)'
                    },
                    gap: 3,
                    mb: 3
                }}
            >
                {statCards.map((card, index) => (
                    <Card 
                        key={index}
                        elevation={0}
                        sx={{ 
                            border: 1,
                            borderColor: 'divider',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            '&:hover': {
                                transform: 'translateY(-4px)',
                                boxShadow: 3
                            }
                        }}
                    >
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="body2" color="text.secondary" gutterBottom>
                                        {card.title}
                                    </Typography>
                                    <Typography variant="h3" fontWeight="bold" sx={{ color: card.color }}>
                                        {card.value}
                                    </Typography>
                                </Box>
                                <Box 
                                    sx={{ 
                                        color: card.color,
                                        opacity: 0.8,
                                        ml: 1
                                    }}
                                >
                                    {card.icon}
                                </Box>
                            </Box>
                            <Typography variant="caption" color="text.secondary">
                                {card.subtitle}
                            </Typography>
                        </CardContent>
                    </Card>
                ))}
            </Box>

            {/* Botones de Sync */}
            <Card elevation={0} sx={{ border: 1, borderColor: 'divider', mb: 2 }}>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <CloudSyncIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                            <Box>
                                <Typography variant="h6" fontWeight="600">
                                    Sync with Attic Tech
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Import new employees from Attic Tech system
                                </Typography>
                            </Box>
                        </Box>
                        <Button
                            variant="contained"
                            startIcon={syncing ? <CircularProgress size={20} color="inherit" /> : <SyncIcon />}
                            onClick={handleSync}
                            disabled={syncing}
                            size="large"
                            sx={{ 
                                minWidth: 150,
                                textTransform: 'none',
                                fontWeight: 600
                            }}
                        >
                            {syncing ? 'Syncing...' : 'Sync Now'}
                        </Button>
                    </Box>
                </CardContent>
            </Card>

            <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <StorageIcon sx={{ fontSize: 40, color: 'secondary.main' }} />
                            <Box>
                                <Typography variant="h6" fontWeight="600">
                                    Sync Legacy Records
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Link existing salespersons and crew members to employee records
                                </Typography>
                            </Box>
                        </Box>
                        <Button
                            variant="outlined"
                            color="secondary"
                            startIcon={syncingLegacy ? <CircularProgress size={20} color="inherit" /> : <StorageIcon />}
                            onClick={handleLegacySync}
                            disabled={syncingLegacy}
                            size="large"
                            sx={{ 
                                minWidth: 150,
                                textTransform: 'none',
                                fontWeight: 600
                            }}
                        >
                            {syncingLegacy ? 'Syncing...' : 'Sync Legacy'}
                        </Button>
                    </Box>
                </CardContent>
            </Card>
        </Box>
    );
};

export default OnboardingDashboard;

