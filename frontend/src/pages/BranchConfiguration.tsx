import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  Typography,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Stack,
  useTheme,
  alpha,
  Grid
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import BusinessIcon from '@mui/icons-material/Business';
import SettingsIcon from '@mui/icons-material/Settings';
import { branchConfigurationsService } from '../config/api';

interface MultiplierRange {
  id: number;
  name: string;
  min_cost: number;
  max_cost: number | null;
  lowest_multiple: number;
  highest_multiple: number;
  at_multiplier_range_id: number;
}

interface Branch {
  id: number;
  name: string;
  attic_tech_branch_id: number;
}

interface BranchConfiguration {
  id: number;
  name: string;
  base_hourly_rate: number;
  average_work_day_hours: number;
  waste_factor: number;
  credit_card_fee: number;
  gas_cost: number;
  truck_average_mpg: number;
  labor_hours_load_unload: number;
  sub_multiplier: number;
  cash_factor: number;
  max_discount: number;
  address: string;
  min_retail_price: number;
  b2b_max_discount: number;
  finance_factors: Record<string, number> | null;
  branches: Branch[];
  multiplierRanges: MultiplierRange[];
}

export default function BranchConfiguration() {
  const theme = useTheme();
  const [configurations, setConfigurations] = useState<BranchConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPanel, setExpandedPanel] = useState<number | false>(false);

  useEffect(() => {
    fetchConfigurations();
  }, []);

  const fetchConfigurations = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await branchConfigurationsService.getAll();
      
      if (!response || !response.data || (response as any).canceled) {
        return;
      }
      
      const configurations = response.data.data;
      
      if (Array.isArray(configurations)) {
        setConfigurations(configurations);
      } else {
        setError('Invalid data format received from server');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Error loading configurations');
    } finally {
      setLoading(false);
    }
  };

  const handleAccordionChange = (panel: number) => (_: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedPanel(isExpanded ? panel : false);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, color: 'primary.main', mb: 1 }}>
          Branch Configurations
        </Typography>
        <Typography variant="body2" color="text.secondary">
          View pricing configurations and multiplier ranges
        </Typography>
      </Box>

      {configurations.length === 0 ? (
        <Alert severity="info">
          No configurations found. Run the sync endpoint to load data.
        </Alert>
      ) : (
        <Stack spacing={2}>
          {configurations.map((config) => (
            <Accordion
              key={config.id}
              expanded={expandedPanel === config.id}
              onChange={handleAccordionChange(config.id)}
              sx={{
                border: `1px solid ${theme.palette.divider}`,
                '&:before': { display: 'none' },
                boxShadow: 'none',
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{
                  backgroundColor: alpha(theme.palette.primary.main, 0.05),
                  borderBottom: expandedPanel === config.id ? `1px solid ${theme.palette.divider}` : 'none',
                }}
              >
                <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
                  <SettingsIcon sx={{ color: 'primary.main' }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {config.name}
                    </Typography>
                  </Box>
                  <Chip
                    icon={<BusinessIcon sx={{ fontSize: 16 }} />}
                    label={`${config.branches?.length || 0} branches`}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                </Stack>
              </AccordionSummary>

              <AccordionDetails sx={{ p: { xs: 2, md: 3 } }}>
                <Stack spacing={3}>
                  {/* Branches */}
                  {config.branches && config.branches.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, color: 'text.secondary' }}>
                        ASSIGNED BRANCHES
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {config.branches.map((branch) => (
                          <Chip
                            key={branch.id}
                            label={branch.name}
                            size="small"
                            sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.1) }}
                          />
                        ))}
                      </Stack>
                    </Box>
                  )}

                  {/* Base Constants Table */}
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, color: 'text.secondary' }}>
                      BASE CONSTANTS
                    </Typography>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 600, width: '50%' }}>Hourly Rate</TableCell>
                            <TableCell>${config.base_hourly_rate}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>Work Day Hours</TableCell>
                            <TableCell>{config.average_work_day_hours}h</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>Waste Factor</TableCell>
                            <TableCell>{config.waste_factor}x</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>Credit Card Fee</TableCell>
                            <TableCell>{config.credit_card_fee}x</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>Cash Factor</TableCell>
                            <TableCell>{config.cash_factor}x</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>Sub Multiplier</TableCell>
                            <TableCell>{config.sub_multiplier}x</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>Min Retail Price</TableCell>
                            <TableCell>${config.min_retail_price?.toLocaleString()}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>Max Discount</TableCell>
                            <TableCell>{config.max_discount}%</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>B2B Max Discount</TableCell>
                            <TableCell>{config.b2b_max_discount}%</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>

                  {/* Finance Factors Table */}
                  {config.finance_factors && Object.keys(config.finance_factors).length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, color: 'text.secondary' }}>
                        FINANCE FACTORS
                      </Typography>
                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.05) }}>
                              <TableCell sx={{ fontWeight: 600 }}>Months</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>Factor</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {Object.entries(config.finance_factors).map(([months, factor]) => (
                              <TableRow key={months}>
                                <TableCell>{months} months</TableCell>
                                <TableCell>
                                  <Chip 
                                    label={`${factor}x`} 
                                    size="small" 
                                    color="primary"
                                    sx={{ fontWeight: 600 }}
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )}

                  {/* Multiplier Ranges Table */}
                  {config.multiplierRanges && config.multiplierRanges.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, color: 'text.secondary' }}>
                        MULTIPLIER RANGES
                      </Typography>
                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.05) }}>
                              <TableCell sx={{ fontWeight: 600 }}>Range Name</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>Min Cost</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>Max Cost</TableCell>
                              <TableCell align="center" sx={{ fontWeight: 600 }}>Low Multiple</TableCell>
                              <TableCell align="center" sx={{ fontWeight: 600 }}>High Multiple</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {config.multiplierRanges.map((range) => (
                              <TableRow key={range.id} hover>
                                <TableCell>{range.name}</TableCell>
                                <TableCell align="right">${range.min_cost?.toLocaleString()}</TableCell>
                                <TableCell align="right">
                                  {range.max_cost ? `$${range.max_cost.toLocaleString()}` : '∞'}
                                </TableCell>
                                <TableCell align="center">
                                  <Chip
                                    label={`${range.lowest_multiple}x`}
                                    size="small"
                                    color="success"
                                    sx={{ minWidth: 60, fontWeight: 600 }}
                                  />
                                </TableCell>
                                <TableCell align="center">
                                  <Chip
                                    label={`${range.highest_multiple}x`}
                                    size="small"
                                    color="error"
                                    sx={{ minWidth: 60, fontWeight: 600 }}
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )}
                </Stack>
              </AccordionDetails>
            </Accordion>
          ))}
        </Stack>
      )}
    </Box>
  );
}
