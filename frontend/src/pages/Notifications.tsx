import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Tabs, Tab, Paper,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
    CircularProgress, Alert, Tooltip, IconButton
} from '@mui/material';
import { Refresh as RefreshIcon, Dashboard as DashboardIcon, History as HistoryIcon } from '@mui/icons-material';
import { format } from 'date-fns';

import notificationService, { type Notification, type FetchNotificationsParams, type DashboardStats } from '../services/notificationService';
import NotificationDashboard from '../components/notifications/Dashboard';

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

    const loadNotifications = async () => {
        setLoading(true);
        try {
            const params: FetchNotificationsParams = { page: page + 1, limit: rowsPerPage };
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
    }, [page, rowsPerPage]);

    const handlePageChange = (_event: unknown, newPage: number) => setPage(newPage);
    const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Notification History</Typography>
                <Tooltip title="Refresh History">
                    <IconButton onClick={loadNotifications}><RefreshIcon /></IconButton>
                </Tooltip>
            </Box>
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