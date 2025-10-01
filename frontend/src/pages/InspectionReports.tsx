import React, { useState, useEffect, useCallback } from 'react';
import { 
    Box, 
    Typography, 
    Paper, 
    TableContainer, 
    Table, 
    TableHead, 
    TableRow, 
    TableCell, 
    TableBody, 
    CircularProgress, 
    Alert,
    TablePagination,
    Chip,
    IconButton,
    Tooltip,
    TableSortLabel,
    Button
} from '@mui/material';
import { OpenInNew as OpenInNewIcon, Download as DownloadIcon } from '@mui/icons-material';
import inspectionReportService, { InspectionReport, InspectionReportsStats } from '../services/inspectionReportService';
import StatsCards from '../components/StatsCards';
import BranchStatsSection from '../components/BranchStatsSection';
import InspectionReportsFilters, { FilterValues } from '../components/InspectionReportsFilters';
import InspectionReportModal from '../components/InspectionReportModal';
import ExportToExcelModal from '../components/ExportToExcelModal';

const InspectionReports = () => {
    const [reports, setReports] = useState<InspectionReport[]>([]);
    const [stats, setStats] = useState<InspectionReportsStats | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [statsLoading, setStatsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalRows, setTotalRows] = useState(0);
    const [selectedReport, setSelectedReport] = useState<InspectionReport | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [filters, setFilters] = useState<FilterValues>({
        search: '',
        branch_name: '',
        salesperson_name: '',
        startDate: '',
        endDate: '',
        type: '',
        service_type: '',
    });
    const [sortBy, setSortBy] = useState<string>('created_at');
    const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

    // Extract unique branches and salespeople for filters
    const [branches, setBranches] = useState<string[]>([]);
    const [salespeople, setSalespeople] = useState<string[]>([]);

    const fetchReports = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // API page is 1-based, MUI is 0-based
            const response = await inspectionReportService.getAll(page + 1, rowsPerPage, {
                ...filters,
                sort: sortBy,
                order: sortOrder,
            });
            
            if (response && Array.isArray(response.data)) {
                setReports(response.data);
                setTotalRows(response.total);
            } else {
                throw new Error('Invalid response structure from API');
            }
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || err.message || 'An unknown error occurred.';
            setError(`Failed to fetch inspection reports: ${errorMessage}`);
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, filters, sortBy, sortOrder]);

    const fetchStats = useCallback(async () => {
        setStatsLoading(true);
        try {
            const statsFilters: any = {};
            if (filters.startDate) statsFilters.startDate = filters.startDate;
            if (filters.endDate) statsFilters.endDate = filters.endDate;
            if (filters.branch_name) statsFilters.branch_name = filters.branch_name;

            const response = await inspectionReportService.getStats(statsFilters);
            if (response && response.data) {
                setStats(response.data);
            }
        } catch (err: any) {
            console.error('Failed to fetch stats:', err);
        } finally {
            setStatsLoading(false);
        }
    }, [filters.startDate, filters.endDate, filters.branch_name]);

    // Fetch unique branches and salespeople for filter dropdowns
    const fetchFilterOptions = useCallback(async () => {
        try {
            const response = await inspectionReportService.getAll(1, 1000, {});
            if (response && Array.isArray(response.data)) {
                const uniqueBranches = Array.from(new Set(response.data.map((r: InspectionReport) => r.branch_name).filter(Boolean)));
                const uniqueSalespeople = Array.from(new Set(response.data.map((r: InspectionReport) => r.salesperson_name).filter(Boolean)));
                setBranches(uniqueBranches as string[]);
                setSalespeople(uniqueSalespeople as string[]);
            }
        } catch (err) {
            console.error('Failed to fetch filter options:', err);
        }
    }, []);

    useEffect(() => {
        fetchReports();
        fetchStats();
    }, [fetchReports, fetchStats]);

    useEffect(() => {
        fetchFilterOptions();
    }, [fetchFilterOptions]);

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleFilterChange = (newFilters: FilterValues) => {
        setFilters(newFilters);
        setPage(0); // Reset to first page when filters change
    };

    const handleSort = (column: string) => {
        const isAsc = sortBy === column && sortOrder === 'ASC';
        setSortOrder(isAsc ? 'DESC' : 'ASC');
        setSortBy(column);
    };

    const handleRowClick = (report: InspectionReport) => {
        setSelectedReport(report);
        setModalOpen(true);
    };

    const handleModalClose = () => {
        setModalOpen(false);
        setSelectedReport(null);
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
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

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    Inspection Reports
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<DownloadIcon />}
                    onClick={() => setExportModalOpen(true)}
                    sx={{ 
                        bgcolor: 'success.main',
                        '&:hover': {
                            bgcolor: 'success.dark',
                        }
                    }}
                >
                    Export to Excel
                </Button>
            </Box>

            {/* Statistics Cards - Below Title */}
            <StatsCards stats={stats} loading={statsLoading} />

            {/* Filters */}
            <InspectionReportsFilters
                onFilterChange={handleFilterChange}
                branches={branches}
                salespeople={salespeople}
            />

            {/* Table */}
            <Paper sx={{ width: '100%', overflow: 'hidden', mb: 4 }}>
                {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}
                
                <TableContainer sx={{ maxHeight: 600 }}>
                    <Table stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'background.paper' }}>
                                    <TableSortLabel
                                        active={sortBy === 'estimate_name'}
                                        direction={sortBy === 'estimate_name' ? sortOrder.toLowerCase() as 'asc' | 'desc' : 'asc'}
                                        onClick={() => handleSort('estimate_name')}
                                    >
                                        Estimate Name
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'background.paper' }}>Salesperson</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'background.paper' }}>Client Info</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'background.paper' }}>
                                    <TableSortLabel
                                        active={sortBy === 'branch_name'}
                                        direction={sortBy === 'branch_name' ? sortOrder.toLowerCase() as 'asc' | 'desc' : 'asc'}
                                        onClick={() => handleSort('branch_name')}
                                    >
                                        Branch
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'background.paper' }}>Status</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'background.paper' }}>Service Type</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'background.paper' }}>
                                    <TableSortLabel
                                        active={sortBy === 'attic_tech_created_at'}
                                        direction={sortBy === 'attic_tech_created_at' ? sortOrder.toLowerCase() as 'asc' | 'desc' : 'asc'}
                                        onClick={() => handleSort('attic_tech_created_at')}
                                    >
                                        Date Created
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell align="center" sx={{ fontWeight: 'bold', backgroundColor: 'background.paper' }}>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={8} align="center">
                                        <CircularProgress />
                                    </TableCell>
                                </TableRow>
                            ) : reports.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} align="center">
                                        <Typography color="text.secondary">No reports found</Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                reports.map((report) => (
                                    <TableRow 
                                        key={report.id} 
                                        hover
                                        onClick={() => handleRowClick(report)}
                                        sx={{ 
                                            cursor: 'pointer',
                                            '&:hover': {
                                                backgroundColor: 'action.hover',
                                            }
                                        }}
                                    >
                                        <TableCell>
                                            <Typography variant="body2" fontWeight="medium">
                                                {report.estimate_name || '-'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" fontWeight="medium">
                                                {report.salesperson_name || '-'}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {report.salesperson_email || '-'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" fontWeight="medium">
                                                {report.client_name || '-'}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                📞 {report.client_phone || '-'}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                ✉️ {report.client_email || '-'}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                📍 {report.client_address || '-'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Chip 
                                                label={report.branch_name || 'Unknown'} 
                                                size="small" 
                                                variant="outlined"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Chip 
                                                label={report.status} 
                                                size="small" 
                                                color={getStatusColor(report.status)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Chip 
                                                label={report.service_type} 
                                                size="small" 
                                                variant="outlined"
                                                color={report.service_type === 'Both' ? 'secondary' : 'default'}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2">
                                                {formatDate(report.attic_tech_created_at)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Tooltip title="View Estimate">
                                                <IconButton
                                                    size="small"
                                                    color="primary"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        window.open(report.estimate_link, '_blank');
                                                    }}
                                                >
                                                    <OpenInNewIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
                <TablePagination
                    rowsPerPageOptions={[5, 10, 25, 50]}
                    component="div"
                    count={totalRows}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                />
            </Paper>

            {/* Reports by Branch Section - At the Bottom */}
            <BranchStatsSection stats={stats} loading={statsLoading} />

            {/* Inspection Report Details Modal */}
            <InspectionReportModal
                open={modalOpen}
                onClose={handleModalClose}
                report={selectedReport}
            />

            {/* Export to Excel Modal */}
            <ExportToExcelModal
                open={exportModalOpen}
                onClose={() => setExportModalOpen(false)}
            />
        </Box>
    );
};

export default InspectionReports;
