import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Tabs, Tab, Paper,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
    CircularProgress, Alert, Tooltip, IconButton, TextField, MenuItem, Stack
} from '@mui/material';
import { Refresh as RefreshIcon, Dashboard as DashboardIcon, History as HistoryIcon } from '@mui/icons-material';
import { format } from 'date-fns';

import notificationService, { type Notification, type FetchNotificationsParams, type DashboardStats } from '../services/notificationService';
import NotificationDashboard from '../components/notifications/Dashboard';
import notificationTypeService, { type NotificationType } from '../services/notificationTypeService';
import notificationTemplateService, { type NotificationTemplate } from '../services/notificationTemplateService';
import salespersonService from '../services/salespersonService';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    return (
        <div role="tabpanel" hidden={value !== index} {...other}>
            {value === index && <Box>{children}</Box>}
        </div>
    );
}

const NotificationsHistory = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0);
    const [filters, setFilters] = useState({
        salespersonId: '',
        messageName: '',
        notificationTypeId: '',
        level: '',
        dateFrom: '',
        dateTo: ''
    });

    const [notificationTypes, setNotificationTypes] = useState<NotificationType[]>([]);
    const [notificationTemplates, setNotificationTemplates] = useState<NotificationTemplate[]>([]);
    const [salespersons, setSalespersons] = useState<Array<{ id: number; name: string }>>([]);

    const loadNotifications = async () => {
        setLoading(true);
        try {
            const params: FetchNotificationsParams = {
                page: page + 1,
                limit: rowsPerPage,
                notificationTypeId: filters.notificationTypeId ? Number(filters.notificationTypeId) : undefined,
                dateFrom: filters.dateFrom || undefined,
                dateTo: filters.dateTo || undefined,
                recipientId: filters.salespersonId ? Number(filters.salespersonId) : undefined,
                recipientType: filters.salespersonId ? 'sales_person' : undefined,
                level: filters.level || undefined,
            };
            const response = await notificationService.fetchNotifications(params);
            setNotifications(response.data);
            setTotalCount(response.total);
        } catch (err: any) {
            setError(err.message || 'Failed to load notification history');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadNotifications();
    }, [page, rowsPerPage, filters]);

    const handleFilterChange = (field: keyof Omit<typeof filters, 'messageName'>, value: string) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };
    
    const handlePageChange = (_event: unknown, newPage: number) => setPage(newPage);
    const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    useEffect(() => {
        (async () => {
            try {
                const [types, templates, sps] = await Promise.all([
                    notificationTypeService.getAll(),
                    notificationTemplateService.getAll(),
                    salespersonService.getSalesPersonsForFilter()
                ]);
                setNotificationTypes(types);
                setNotificationTemplates(templates);
                setSalespersons(sps.map(sp => ({ id: sp.id, name: sp.name })).sort((a, b) => a.name.localeCompare(b.name)));
            } catch (_e) {
                // noop
            }
        })();
    }, []);

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Notification History</Typography>
                <Tooltip title="History is automatically refreshed upon filter change.">
                    <IconButton>
                        <RefreshIcon style={{ opacity: 0.5 }}/>
                    </IconButton>
                </Tooltip>
            </Box>
            <Paper sx={{ p: 2, mb: 2 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
                    <TextField
                        label="Recipient"
                        size="small"
                        select
                        value={filters.salespersonId}
                        onChange={(e) => handleFilterChange('salespersonId', e.target.value)}
                        sx={{ minWidth: 220 }}
                    >
                        <MenuItem value="">All</MenuItem>
                        {salespersons.map((sp) => (
                            <MenuItem key={sp.id} value={String(sp.id)}>{sp.name}</MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        label="Notification Type"
                        size="small"
                        select
                        value={filters.notificationTypeId}
                        onChange={(e) => handleFilterChange('notificationTypeId', e.target.value)}
                        sx={{ minWidth: 220 }}
                    >
                        <MenuItem value="">All</MenuItem>
                        {notificationTypes.map((t) => (
                            <MenuItem key={t.id} value={String(t.id)}>{t.name}</MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        label="Level"
                        size="small"
                        select
                        value={filters.level}
                        onChange={(e) => handleFilterChange('level', e.target.value)}
                        sx={{ minWidth: 160 }}
                    >
                        <MenuItem value="">All</MenuItem>
                        <MenuItem value="1">Warning 1</MenuItem>
                        <MenuItem value="2">Warning 2</MenuItem>
                        <MenuItem value="3+">Warning 3+</MenuItem>
                    </TextField>
                    <TextField
                        label="From"
                        type="date"
                        size="small"
                        InputLabelProps={{ shrink: true }}
                        value={filters.dateFrom}
                        onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                    />
                    <TextField
                        label="To"
                        type="date"
                        size="small"
                        InputLabelProps={{ shrink: true }}
                        value={filters.dateTo}
                        onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                    />
                </Stack>
            </Paper>
            {loading && <CircularProgress />}
            {error && <Alert severity="error">{error}</Alert>}
            <Paper>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Date</TableCell>
                                <TableCell>Recipient</TableCell>
                                <TableCell>Message</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {notifications.map((n) => (
                                <TableRow key={n.id}>
                                    <TableCell>{format(new Date(n.created_at), 'PPP p')}</TableCell>
                                    <TableCell>{n.recipient_name || `${n.recipient_type} #${n.recipient_id}`}</TableCell>
                                    <TableCell>{n.message}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
                <TablePagination
                    component="div"
                    count={totalCount}
                    page={page}
                    onPageChange={handlePageChange}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={handleRowsPerPageChange}
                />
            </Paper>
        </Box>
    );
};


const NotificationsPage: React.FC = () => {
    const [tabValue, setTabValue] = useState(0);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loadingStats, setLoadingStats] = useState(false);
    const [statsError, setStatsError] = useState<string | null>(null);

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    const loadStats = async () => {
        setLoadingStats(true);
        setStatsError(null);
        try {
            const data = await notificationService.fetchDashboardStats();
            setStats(data);
        } catch (err: any) {
            setStatsError(err.message || 'Failed to load dashboard stats');
        } finally {
            setLoadingStats(false);
        }
    };

    useEffect(() => {
        loadStats();
        (async () => {
            try {
                const [types, templates] = await Promise.all([
                    notificationTypeService.getAll(),
                    notificationTemplateService.getAll()
                ]);
                setNotificationTypes(types);
                setNotificationTemplates(templates);
            } catch (e) {}
        })();
    }, []);

    return (
        <Box sx={{ width: '100%' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={tabValue} onChange={handleTabChange}>
                    <Tab label="Dashboard" icon={<DashboardIcon />} iconPosition="start" />
                    <Tab label="History" icon={<HistoryIcon />} iconPosition="start" />
                </Tabs>
            </Box>
            <TabPanel value={tabValue} index={0}>
                <NotificationDashboard stats={stats} loading={loadingStats} error={statsError} />
            </TabPanel>
            <TabPanel value={tabValue} index={1}>
                <NotificationsHistory />
            </TabPanel>
        </Box>
    );
};

export default NotificationsPage; 