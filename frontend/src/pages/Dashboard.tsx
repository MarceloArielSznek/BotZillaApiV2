import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  Tab,
  Tabs,
  IconButton,
  LinearProgress,
  Avatar,
  Divider,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Grid,
} from '@mui/material';
import {
  Assessment as EstimatesIcon,
  People as PeopleIcon,
  Business as BusinessIcon,
  Work as JobsIcon,
  Notifications as NotificationsIcon,
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  FilterList as FilterIcon,
  Sync as SyncIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';

// Hardcoded data based on database structure
const hardcodedData = {
  estimates: [
    { id: 1, name: 'Smith House - Roof Repair', branch: 'Miami', salesperson: 'John Perez', status: 'active', created_date: '2024-01-15', price: 5500.00, discount: 200.00 },
    { id: 2, name: 'Central Office - AC Installation', branch: 'Orlando', salesperson: 'Maria Gonzalez', status: 'pending', created_date: '2024-01-18', price: 8300.00, discount: 0.00 },
    { id: 3, name: 'Johnson Residence - Painting', branch: 'Tampa', salesperson: 'Carlos Rivera', status: 'completed', created_date: '2024-01-10', price: 3200.00, discount: 150.00 },
    { id: 4, name: 'Shopping Center - Repairs', branch: 'Jacksonville', salesperson: 'Ana Martinez', status: 'released', created_date: '2024-01-20', price: 12500.00, discount: 500.00 },
    { id: 5, name: 'Elementary School - Maintenance', branch: 'Miami', salesperson: 'Robert Sanchez', status: 'cancelled', created_date: '2024-01-12', price: 4100.00, discount: 0.00 },
  ],
  salespersons: [
    { id: 1, name: 'John Perez', phone: '+1-305-555-0101', telegram_id: '@johnperez', warning_count: 0, active_jobs: 3, branches: ['Miami', 'Fort Lauderdale'], is_manager: true },
    { id: 2, name: 'Maria Gonzalez', phone: '+1-407-555-0102', telegram_id: '@mariag', warning_count: 1, active_jobs: 5, branches: ['Orlando'], is_manager: false },
    { id: 3, name: 'Carlos Rivera', phone: '+1-813-555-0103', telegram_id: '@carlosr', warning_count: 0, active_jobs: 2, branches: ['Tampa'], is_manager: false },
    { id: 4, name: 'Ana Martinez', phone: '+1-904-555-0104', telegram_id: '@anam', warning_count: 2, active_jobs: 4, branches: ['Jacksonville'], is_manager: false },
    { id: 5, name: 'Robert Sanchez', phone: '+1-305-555-0105', telegram_id: '', warning_count: 0, active_jobs: 1, branches: ['Miami'], is_manager: false },
  ],
  branches: [
    { id: 1, name: 'Miami', address: '1234 SW 8th St, Miami, FL 33135' },
    { id: 2, name: 'Orlando', address: '5678 International Dr, Orlando, FL 32819' },
    { id: 3, name: 'Tampa', address: '9101 N Florida Ave, Tampa, FL 33612' },
    { id: 4, name: 'Jacksonville', address: '1121 Riverplace Blvd, Jacksonville, FL 32207' },
    { id: 5, name: 'Fort Lauderdale', address: '1314 E Las Olas Blvd, Fort Lauderdale, FL 33301' },
  ],
  jobs: [
    { id: 1, name: 'Smith House - Roof Repair', closing_date: '2024-01-25', estimate_id: 1, crew_leader: 'Mike Johnson', review: 5, hours: 24 },
    { id: 2, name: 'Central Office - AC Installation', closing_date: '2024-02-01', estimate_id: 2, crew_leader: 'Steve Davis', review: 4, hours: 32 },
    { id: 3, name: 'Johnson Residence - Painting', closing_date: '2024-01-28', estimate_id: 3, crew_leader: 'Tony Wilson', review: 5, hours: 16 },
  ],
  notifications: [
    { id: 1, message: 'New estimate created: Smith House', created_at: '2024-01-20 10:30', type: 'info' },
    { id: 2, message: 'Job completed: Johnson Residence', created_at: '2024-01-20 09:15', type: 'success' },
    { id: 3, message: 'Warning sent to Maria Gonzalez', created_at: '2024-01-20 08:45', type: 'warning' },
    { id: 4, message: 'System synchronized successfully', created_at: '2024-01-20 08:00', type: 'success' },
  ],
  warnings: [
    { id: 1, salesperson: 'Maria Gonzalez', reason: 'Late submission', created_at: '2024-01-18' },
    { id: 2, salesperson: 'Ana Martinez', reason: 'Missed appointment', created_at: '2024-01-17' },
    { id: 3, salesperson: 'Ana Martinez', reason: 'Customer complaint', created_at: '2024-01-15' },
  ]
};

const StatCard = ({ icon, title, value, trend, color, subtitle }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
  >
    <Paper
      sx={{
        p: 3,
        height: '100%',
        background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`,
        border: `1px solid ${color}30`,
        borderRadius: 3,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        '&:hover': {
          transform: 'translateY(-4px)',
          transition: 'transform 0.3s ease-in-out',
          boxShadow: `0 8px 25px ${color}20`,
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Avatar sx={{ bgcolor: color, mr: 2 }}>
        {icon}
        </Avatar>
        <Box>
          <Typography variant="h6" color="text.primary" fontWeight={600}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        </Box>
      </Box>
      <Typography variant="h3" sx={{ mb: 1, fontWeight: 'bold', color: color }}>
        {value}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <TrendingUpIcon sx={{ color: '#4CAF50', fontSize: '1.2rem' }} />
        <Typography variant="body2" color="#4CAF50" fontWeight={500}>
          {trend}
        </Typography>
      </Box>
    </Paper>
  </motion.div>
);

const DataTable = ({ title, data, columns, onEdit, onDelete, onAdd }: any) => (
  <Paper sx={{ p: 0, borderRadius: 3, overflow: 'hidden' }}>
    <Box sx={{ p: 3, display: 'flex', justifyContent: 'between', alignItems: 'center', bgcolor: 'primary.main' }}>
      <Typography variant="h6" color="white" fontWeight={600}>
        {title}
      </Typography>
      {onAdd && (
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onAdd}
          sx={{ bgcolor: 'secondary.main', '&:hover': { bgcolor: 'secondary.dark' } }}
                 >
           Add
         </Button>
      )}
            </Box>
    <TableContainer sx={{ maxHeight: 400 }}>
      <Table stickyHeader>
        <TableHead>
          <TableRow>
            {columns.map((column: any) => (
              <TableCell key={column.id} sx={{ fontWeight: 600, bgcolor: 'background.paper' }}>
                {column.label}
              </TableCell>
            ))}
                             <TableCell sx={{ fontWeight: 600, bgcolor: 'background.paper' }}>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row: any) => (
            <TableRow key={row.id} hover>
              {columns.map((column: any) => (
                <TableCell key={column.id}>
                  {column.format ? column.format(row[column.id]) : row[column.id]}
                </TableCell>
              ))}
              <TableCell>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {onEdit && (
                    <IconButton
                      size="small"
                      onClick={() => onEdit(row)}
                      sx={{ color: 'primary.main' }}
                    >
                      <EditIcon />
                    </IconButton>
                  )}
                  {onDelete && (
                    <IconButton
                      size="small"
                      onClick={() => onDelete(row.id)}
                      sx={{ color: 'error.main' }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  )}
            </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
    </Paper>
);

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogType, setDialogType] = useState('');

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const formatStatus = (status: string) => {
    const colors: any = {
      pending: 'warning',
      active: 'info',
      released: 'primary',
      completed: 'success',
      cancelled: 'error',
    };
    return <Chip label={status.toUpperCase()} color={colors[status] || 'default'} size="small" />;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US');
  };

  const estimateColumns = [
    { id: 'name', label: 'Name' },
    { id: 'branch', label: 'Branch' },
    { id: 'salesperson', label: 'Salesperson' },
    { id: 'status', label: 'Status', format: formatStatus },
    { id: 'price', label: 'Price', format: formatCurrency },
    { id: 'created_date', label: 'Date', format: formatDate },
  ];

  const salespersonColumns = [
    { id: 'name', label: 'Name' },
    { id: 'phone', label: 'Phone' },
    { id: 'telegram_id', label: 'Telegram' },
    { id: 'warning_count', label: 'Warnings' },
    { id: 'active_jobs', label: 'Active Jobs' },
    { id: 'branches', label: 'Branches', format: (branches: string[]) => branches.join(', ') },
  ];

  const branchColumns = [
    { id: 'name', label: 'Name' },
    { id: 'address', label: 'Address' },
  ];

  const jobColumns = [
    { id: 'name', label: 'Name' },
    { id: 'crew_leader', label: 'Crew Leader' },
    { id: 'review', label: 'Review', format: (review: number) => `⭐ ${review}/5` },
    { id: 'hours', label: 'Hours' },
    { id: 'closing_date', label: 'Closing Date', format: formatDate },
  ];

  const renderMainDashboard = () => (
    <Box>
      <Typography
        variant="h4"
        component="h1"
        sx={{
          mb: 4,
          fontWeight: 600,
          background: 'linear-gradient(45deg, #4CAF50, #FF9800)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
                 BotZilla Dashboard
      </Typography>

             {/* Main Statistics */}
       <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 4 }}>
         <Box sx={{ flex: '1 1 250px', minWidth: '250px' }}>
          <StatCard
             icon={<EstimatesIcon />}
             title="Total Estimates"
             value={hardcodedData.estimates.length}
             subtitle="Active estimates"
            trend="+12% this week"
             color="#4CAF50"
          />
         </Box>
         <Box sx={{ flex: '1 1 250px', minWidth: '250px' }}>
          <StatCard
             icon={<PeopleIcon />}
             title="Salespersons"
             value={hardcodedData.salespersons.length}
             subtitle="Active salespeople"
             trend="+5% this month"
             color="#FF9800"
           />
         </Box>
         <Box sx={{ flex: '1 1 250px', minWidth: '250px' }}>
          <StatCard
             icon={<BusinessIcon />}
             title="Branches"
             value={hardcodedData.branches.length}
             subtitle="Active locations"
             trend="Stable"
             color="#2196F3"
           />
         </Box>
         <Box sx={{ flex: '1 1 250px', minWidth: '250px' }}>
          <StatCard
             icon={<JobsIcon />}
             title="Active Jobs"
             value={hardcodedData.jobs.length}
             subtitle="Jobs in progress"
             trend="+8% this week"
             color="#9C27B0"
           />
         </Box>
       </Box>

             {/* Actividad reciente y alertas */}
       <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
         <Box sx={{ flex: '2 1 400px', minWidth: '400px' }}>
           <Paper sx={{ p: 3, borderRadius: 3 }}>
             <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
               <NotificationsIcon sx={{ mr: 1, color: 'primary.main' }} />
               Recent Activity
             </Typography>
             <Box>
               {hardcodedData.notifications.map((notification, index) => (
                 <Alert
                   key={notification.id}
                   severity={notification.type as any}
                   sx={{ mb: 2 }}
                 >
                   <Box>
                     <Typography variant="body1">{notification.message}</Typography>
                     <Typography variant="caption" color="text.secondary">
                       {notification.created_at}
                     </Typography>
                   </Box>
                 </Alert>
               ))}
             </Box>
           </Paper>
         </Box>
         <Box sx={{ flex: '1 1 300px', minWidth: '300px' }}>
           <Paper sx={{ p: 3, borderRadius: 3 }}>
             <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
               <WarningIcon sx={{ mr: 1, color: 'warning.main' }} />
               Recent Warnings
             </Typography>
             <Box>
               {hardcodedData.warnings.map((warning) => (
                 <Box key={warning.id} sx={{ mb: 2, p: 2, bgcolor: 'rgba(255, 152, 0, 0.1)', borderRadius: 2, border: '1px solid rgba(255, 152, 0, 0.3)' }}>
                   <Typography variant="body2" fontWeight={600} color="warning.main">
                     {warning.salesperson}
                   </Typography>
                   <Typography variant="body2" color="text.primary">
                     {warning.reason}
                   </Typography>
                   <Typography variant="caption" color="text.secondary">
                     {formatDate(warning.created_at)}
                   </Typography>
                 </Box>
               ))}
             </Box>
           </Paper>
         </Box>
       </Box>
    </Box>
  );

  const renderEstimates = () => (
    <DataTable
      title="Estimates"
      data={hardcodedData.estimates}
      columns={estimateColumns}
      onEdit={() => setOpenDialog(true)}
      onDelete={() => {}}
      onAdd={() => setOpenDialog(true)}
    />
  );

  const renderSalespersons = () => (
    <DataTable
      title="Salespersons"
      data={hardcodedData.salespersons}
      columns={salespersonColumns}
      onEdit={() => setOpenDialog(true)}
      onDelete={() => {}}
      onAdd={() => setOpenDialog(true)}
    />
  );

     const renderBranches = () => (
     <DataTable
       title="Branches"
      data={hardcodedData.branches}
      columns={branchColumns}
      onEdit={() => setOpenDialog(true)}
      onDelete={() => {}}
      onAdd={() => setOpenDialog(true)}
    />
  );

  const renderJobs = () => (
    <DataTable
      title="Jobs"
      data={hardcodedData.jobs}
      columns={jobColumns}
      onEdit={() => setOpenDialog(true)}
      onDelete={() => {}}
      onAdd={() => setOpenDialog(true)}
    />
  );

  const renderSync = () => (
    <Paper sx={{ p: 4, borderRadius: 3, textAlign: 'center' }}>
      <SyncIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
      <Typography variant="h5" sx={{ mb: 2 }}>
        System Synchronization
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Synchronize data with external systems
      </Typography>
      <Button
        variant="contained"
        size="large"
        startIcon={<SyncIcon />}
        sx={{ mb: 3 }}
      >
        Run Synchronization
      </Button>
      <Paper sx={{ p: 2, bgcolor: 'background.default', fontFamily: 'monospace' }}>
        <Typography variant="body2" color="success.main">
          [2024-01-20 10:30:00] System started...
          <br />
          [2024-01-20 10:30:15] Connecting to external API...
          <br />
          [2024-01-20 10:30:30] Synchronization completed ✓
          <br />
          [2024-01-20 10:30:31] 15 estimates processed
        </Typography>
      </Paper>
    </Paper>
  );

  const tabContent = [
    renderMainDashboard(),
    renderEstimates(),
    renderSalespersons(),
    renderBranches(),
    renderJobs(),
    renderSync(),
  ];

  return (
    <Box>
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Dashboard" />
          <Tab label="Estimates" />
          <Tab label="Salespersons" />
          <Tab label="Branches" />
          <Tab label="Jobs" />
          <Tab label="Sync" />
        </Tabs>
      </Paper>

      <Box>{tabContent[activeTab]}</Box>

             <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
         <DialogTitle>Functionality Under Development</DialogTitle>
         <DialogContent>
           <Typography>
             This functionality will be implemented when the backend is fully developed.
             For now, this is a hardcoded dashboard to show the final structure and design.
           </Typography>
         </DialogContent>
         <DialogActions>
           <Button onClick={() => setOpenDialog(false)}>Close</Button>
         </DialogActions>
       </Dialog>
    </Box>
  );
};

export default Dashboard; 