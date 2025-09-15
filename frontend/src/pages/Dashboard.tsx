import React, { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  LinearProgress,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
  CircularProgress,
  Alert,
  Stack,
  IconButton,
  Tooltip,
  alpha,
} from '@mui/material';
import {
  Assessment as EstimatesIcon,
  People as PeopleIcon,
  Business as BusinessIcon,
  Work as JobsIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AttachMoney as MoneyIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Person as PersonIcon,
  Groups as GroupsIcon,
  Notifications as NotificationsIcon,
  LocationOn as LocationIcon,
  Star as StarIcon,
  Schedule as ScheduleIcon,
  Speed as SpeedIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { 
  getDashboardSummary, 
  type DashboardSummary, 
  type EstimatesByStatus,
  type SalespersonPerformance,
  type BranchMetrics 
} from '../services/dashboardService';

// Función para formatear moneda
const formatCurrency = (amount: number | string) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('es-US', { 
    style: 'currency', 
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num || 0);
};

// Función para formatear números
const formatNumber = (num: number | string) => {
  const number = typeof num === 'string' ? parseFloat(num) : num;
  return new Intl.NumberFormat('es-US').format(number || 0);
};

// Función para obtener color de tendencia
const getTrendColor = (value: number) => value >= 0 ? '#4CAF50' : '#F44336';

// Componente StatCard mejorado
interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactElement;
  color: string;
  trend?: {
    value: number;
    label: string;
  };
  subtitle?: string;
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  icon, 
  color, 
  trend, 
  subtitle,
  onClick 
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
  >
    <Card
      sx={{
        height: '100%',
        background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`,
        border: `1px solid ${color}30`,
        borderRadius: 3,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.3s ease-in-out',
        '&:hover': {
          transform: onClick ? 'translateY(-4px)' : 'none',
          boxShadow: `0 8px 25px ${color}20`,
          borderColor: `${color}50`,
        },
      }}
      onClick={onClick}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
          <Avatar sx={{ bgcolor: color, width: 56, height: 56 }}>
            {React.cloneElement(icon, { sx: { fontSize: 28 } })}
        </Avatar>
          {trend && (
            <Box sx={{ textAlign: 'right' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', color: getTrendColor(trend.value) }}>
                {trend.value >= 0 ? <TrendingUpIcon sx={{ fontSize: 16, mr: 0.5 }} /> : <TrendingDownIcon sx={{ fontSize: 16, mr: 0.5 }} />}
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {trend.value > 0 ? '+' : ''}{trend.value.toFixed(1)}%
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {trend.label}
              </Typography>
            </Box>
          )}
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 700, color: color, mb: 1 }}>
          {typeof value === 'number' ? formatNumber(value) : value}
        </Typography>
        <Typography variant="h6" color="text.primary" sx={{ fontWeight: 600, mb: 0.5 }}>
            {title}
          </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  </motion.div>
);

// Componente para métricas de estimates por estado
interface EstimateStatusChartProps {
  data: EstimatesByStatus[];
}

const EstimateStatusChart: React.FC<EstimateStatusChartProps> = ({ data }) => {
  const total = data.reduce((sum, item) => sum + parseInt(item.count), 0);
  
  const statusColors: { [key: string]: string } = {
    'pending': '#FF9800',
    'active': '#2196F3', 
    'released': '#9C27B0',
    'completed': '#4CAF50',
    'cancelled': '#F44336',
  };

      return (
      <Card sx={{ height: '100%', borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
            Estimates by Status
          </Typography>
        <Stack spacing={2}>
          {data.map((item) => {
            const percentage = total > 0 ? (parseInt(item.count) / total) * 100 : 0;
            const color = statusColors[item.name.toLowerCase()] || '#9E9E9E';
            
            return (
              <Box key={item.id}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, textTransform: 'capitalize' }}>
                    {item.name}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {item.count}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ({percentage.toFixed(1)}%)
          </Typography>
        </Box>
      </Box>
                <LinearProgress
                  variant="determinate"
                  value={percentage}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: alpha(color, 0.2),
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: color,
                      borderRadius: 4,
                    },
                  }}
                />
              </Box>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
};

// Componente para Top Performers
interface TopPerformersProps {
  performers: SalespersonPerformance[];
}

  const TopPerformers: React.FC<TopPerformersProps> = ({ performers }) => (
    <Card sx={{ height: '100%', borderRadius: 3 }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
          Top Performers This Month
        </Typography>
      <List>
        {performers.slice(0, 5).map((performer, index) => (
          <React.Fragment key={performer.id}>
            <ListItem sx={{ px: 0 }}>
              <ListItemAvatar>
                <Avatar sx={{ 
                  bgcolor: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : 'primary.main',
                  width: 40,
                  height: 40
                }}>
                  {index < 3 ? <StarIcon /> : <PersonIcon />}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {performer.name}
                    </Typography>
                    <Chip 
                      label={`#${index + 1}`} 
                      size="small" 
                      color={index < 3 ? 'primary' : 'default'}
                    />
                  </Box>
                }
                secondary={
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Revenue: {formatCurrency(performer.revenueThisMonth)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {performer.estimatesThisMonth} estimates • {performer.activeLeads} active
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
            {index < performers.length - 1 && <Divider />}
          </React.Fragment>
        ))}
      </List>
    </CardContent>
  </Card>
);

// Componente para Branch Metrics
interface BranchMetricsProps {
  branches: BranchMetrics[];
}

const BranchMetricsGrid: React.FC<BranchMetricsProps> = ({ branches }) => (
  <Card sx={{ borderRadius: 3, width: '100%' }}>
    <CardContent sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
        Performance by Branch
      </Typography>
      <Box sx={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: 2,
        width: '100%',
        overflow: 'hidden'
      }}>
        {branches && branches.map((branch) => (
          <Box key={branch.id} sx={{ flex: '1 1 280px', minWidth: '280px' }}>
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
                  {branch.name}
                </Typography>
              </Box>
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Active Estimates
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {branch.activeEstimates}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Jobs This Month
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {branch.jobsThisMonth}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Monthly Revenue
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#4CAF50' }}>
                    {formatCurrency(branch.revenueThisMonth)}
        </Typography>
                </Box>
              </Stack>
            </Paper>
          </Box>
        ))}
      </Box>
    </CardContent>
  </Card>
);

// Componente para alertas
interface AlertsPanelProps {
  overLimitSalespersons: SalespersonPerformance[];
  recentWarnings: Array<{ id: number; message: string; created_at: string; salesPersonRecipient?: { name: string } }>;
}

const AlertsPanel: React.FC<AlertsPanelProps> = ({ overLimitSalespersons, recentWarnings }) => (
  <Card sx={{ height: '100%', borderRadius: 3 }}>
    <CardContent sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, display: 'flex', alignItems: 'center' }}>
        <WarningIcon sx={{ mr: 1, color: 'warning.main' }} />
        System Alerts
      </Typography>
      
      {overLimitSalespersons.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, color: 'error.main' }}>
            Salespersons Over Limit ({overLimitSalespersons.length})
          </Typography>
          {overLimitSalespersons.slice(0, 3).map((sp) => (
            <Alert 
              key={sp.id} 
              severity="error" 
              sx={{ mb: 1, py: 0 }}
            >
              <Typography variant="body2">
                <strong>{sp.name}</strong> - {sp.activeLeads} active leads
              </Typography>
            </Alert>
          ))}
        </Box>
      )}

      {recentWarnings.length > 0 && (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1, color: 'warning.main' }}>
            Recent Warnings
          </Typography>
          {recentWarnings.slice(0, 3).map((warning) => (
            <Alert 
              key={warning.id} 
              severity="warning" 
              sx={{ mb: 1, py: 0 }}
            >
              <Typography variant="body2">
                {warning.salesPersonRecipient?.name || 'User'}: {warning.message}
              </Typography>
            </Alert>
          ))}
        </Box>
      )}

      {overLimitSalespersons.length === 0 && recentWarnings.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            All clear! No pending alerts.
          </Typography>
        </Box>
      )}
    </CardContent>
  </Card>
);

// Componente principal del Dashboard
const Dashboard: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
      try {
        setLoading(true);
      setError(null);
        const data = await getDashboardSummary();
        setSummary(data);
    } catch (err) {
      setError('Error al cargar el dashboard. Por favor, intenta de nuevo.');
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '60vh' 
      }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert 
        severity="error" 
        sx={{ m: 3 }}
        action={
          <IconButton onClick={loadDashboard} color="inherit">
            <RefreshIcon />
          </IconButton>
        }
      >
        {error}
      </Alert>
    );
  }

  if (!summary) {
    return (
      <Alert severity="info" sx={{ m: 3 }}>
        No hay datos disponibles para mostrar.
      </Alert>
    );
  }

  const { businessMetrics, teamPerformance, branchMetrics, notifications, systemStats } = summary;

    return (
    <Box sx={{ 
      width: '100%', 
      maxWidth: '100vw',
      minHeight: '100vh',
      p: { xs: 2, sm: 3 },
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      boxSizing: 'border-box'
    }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
      <Typography
        variant="h4"
        component="h1"
        sx={{
            fontWeight: 700,
            background: 'linear-gradient(45deg, #4CAF50, #2196F3)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
            mb: 1,
        }}
      >
                 BotZilla Dashboard
      </Typography>
        <Typography variant="body1" color="text.secondary">
          Complete system overview - {new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
       </Typography>
      </Box>

      {/* Contenedor Flex para las métricas principales */}
      <Box sx={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: 3, 
        mb: 4,
        width: '100%',
        overflow: 'hidden'
      }}>
                <Box sx={{ flex: '1 1 280px', minWidth: '280px', maxWidth: '380px' }}>
          <StatCard
            title="Total Estimates"
            value={businessMetrics.estimates.total}
            icon={<EstimatesIcon />}
            color="#4CAF50"
            subtitle={`${businessMetrics.estimates.active} active`}
            trend={{
              value: businessMetrics.estimates.weeklyAverage,
              label: 'weekly average'
            }}
          />
        </Box>
        <Box sx={{ flex: '1 1 280px', minWidth: '280px', maxWidth: '380px' }}>
          <StatCard
            title="Monthly Revenue"
            value={formatCurrency(businessMetrics.revenue.thisMonth)}
            icon={<MoneyIcon />}
            color="#FF9800"
            subtitle="Monthly income"
            trend={{
              value: businessMetrics.revenue.growth,
              label: 'vs last month'
            }}
          />
        </Box>
        <Box sx={{ flex: '1 1 280px', minWidth: '280px', maxWidth: '380px' }}>
          <StatCard
            title="Monthly Jobs"
            value={businessMetrics.jobs.thisMonth}
            icon={<JobsIcon />}
            color="#2196F3"
            subtitle={`${businessMetrics.jobs.completedToday} completed today`}
            trend={{
              value: businessMetrics.jobs.growth,
              label: 'vs last month'
            }}
          />
        </Box>
        <Box sx={{ flex: '1 1 280px', minWidth: '280px', maxWidth: '380px' }}>
          <StatCard
            title="Total Team"
            value={teamPerformance.salespersons.total + teamPerformance.crew.total}
            icon={<GroupsIcon />}
            color="#9C27B0"
            subtitle={`${teamPerformance.salespersons.total} sales, ${teamPerformance.crew.total} crew`}
          />
        </Box>
      </Box>

      {/* Segunda fila de métricas en flex */}
      <Box sx={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: 3, 
        mb: 4,
        width: '100%',
        overflow: 'hidden'
      }}>
                <Box sx={{ flex: '1 1 280px', minWidth: '280px', maxWidth: '380px' }}>
          <StatCard
            title="Branches"
            value={systemStats.totalBranches}
            icon={<BusinessIcon />}
            color="#607D8B"
            subtitle="Active locations"
          />
        </Box>
        <Box sx={{ flex: '1 1 280px', minWidth: '280px', maxWidth: '380px' }}>
          <StatCard
            title="Notifications"
            value={notifications.sentToday}
            icon={<NotificationsIcon />}
            color="#FF5722"
            subtitle={`${notifications.sentThisWeek} this week`}
          />
        </Box>
        <Box sx={{ flex: '1 1 280px', minWidth: '280px', maxWidth: '380px' }}>
          <StatCard
            title="Active Alerts"
            value={teamPerformance.salespersons.overLimit.length}
            icon={<WarningIcon />}
            color="#F44336"
            subtitle="Salespersons over limit"
          />
        </Box>
        <Box sx={{ flex: '1 1 280px', minWidth: '280px', maxWidth: '380px' }}>
          <StatCard
            title="System Users"
            value={systemStats.totalUsers}
            icon={<PeopleIcon />}
            color="#795548"
            subtitle="Active accounts"
          />
        </Box>
       </Box>

      {/* Gráficos y análisis detallado en flex */}
      <Box sx={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: 3, 
        mb: 4,
        width: '100%',
        overflow: 'hidden'
      }}>
                <Box sx={{ flex: '1 1 350px', minWidth: '350px', maxWidth: '500px' }}>
          <EstimateStatusChart data={businessMetrics.estimates.byStatus} />
        </Box>
        <Box sx={{ flex: '1 1 350px', minWidth: '350px', maxWidth: '500px' }}>
          <TopPerformers performers={teamPerformance.salespersons.topPerformers} />
        </Box>
        <Box sx={{ flex: '1 1 350px', minWidth: '350px', maxWidth: '500px' }}>
          <AlertsPanel 
            overLimitSalespersons={teamPerformance.salespersons.overLimit}
            recentWarnings={notifications.recentWarnings}
          />
        </Box>
             </Box>

      {/* Performance por sucursal */}
      <Box sx={{ mb: 4 }}>
        <BranchMetricsGrid branches={branchMetrics} />
         </Box>

            {/* Jobs recientes con performance */}
      {businessMetrics.jobs.recent.length > 0 && (
        <Card sx={{ borderRadius: 3, width: '100%' }}>
          <CardContent sx={{ p: 3 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
            Recent Jobs with Performance
             </Typography>
            <Box sx={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: 2,
              width: '100%',
              overflow: 'hidden'
            }}>
              {businessMetrics.jobs.recent.slice(0, 6).map((job) => (
                <Box key={job.id} sx={{ flex: '1 1 320px', minWidth: '320px', maxWidth: '450px' }}>
                  <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid #e0e0e0', height: '100%' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                      {job.name}
                    </Typography>
                    <Stack spacing={1}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">
                          Branch:
                        </Typography>
                        <Typography variant="caption">
                          {job.branch || 'N/A'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">
                          Crew Leader:
                        </Typography>
                        <Typography variant="caption">
                          {job.crewLeader || 'N/A'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">
                          Time Savings:
                        </Typography>
                        <Typography variant="caption" sx={{ 
                          color: job.actualSavedPercent >= 0 ? '#4CAF50' : '#F44336',
                          fontWeight: 600
                        }}>
                          {job.actualSavedPercent >= 0 ? '+' : ''}{(job.actualSavedPercent * 100).toFixed(1)}%
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">
                          Bonus:
                        </Typography>
                        <Typography variant="caption" sx={{ 
                          color: '#4CAF50',
                          fontWeight: 600
                        }}>
                          {formatCurrency(job.jobBonusPool)}
                    </Typography>
                  </Box>
                      {job.review && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">
                            Review:
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {[...Array(5)].map((_, i) => (
                              <StarIcon 
                                key={i}
                                sx={{ 
                                  fontSize: 12, 
                                  color: i < job.review! ? '#FFD700' : '#E0E0E0' 
                                }} 
                              />
                ))}
             </Box>
                        </Box>
                      )}
                    </Stack>
           </Paper>
         </Box>
              ))}
       </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default Dashboard; 