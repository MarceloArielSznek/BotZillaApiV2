import React, { useState } from 'react';
import { Box, Typography, Tabs, Tab, Paper } from '@mui/material';
import { People as SalesIcon, Construction as CrewIcon } from '@mui/icons-material';
import SalespersonsTab from '../components/employees/SalespersonsTab';
import CrewMembersTab from '../components/employees/CrewMembersTab';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`employees-tabpanel-${index}`}
      aria-labelledby={`employees-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
};

const a11yProps = (index: number) => {
  return {
    id: `employees-tab-${index}`,
    'aria-controls': `employees-tabpanel-${index}`,
  };
};

const Employees = () => {
  const [value, setValue] = useState(0);

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
          Employee Management
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Manage your sales team and crew members
        </Typography>
      </Box>

      {/* Tabs */}
      <Paper sx={{ borderRadius: 2 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={value} 
            onChange={handleChange} 
            aria-label="employees tabs"
            sx={{ 
              '& .MuiTab-root': { 
                textTransform: 'none',
                fontSize: '1rem',
                fontWeight: 500,
                minHeight: 48
              }
            }}
          >
            <Tab 
              icon={<SalesIcon />} 
              iconPosition="start" 
              label="Sales Team" 
              {...a11yProps(0)} 
            />
            <Tab 
              icon={<CrewIcon />} 
              iconPosition="start" 
              label="Crew Members" 
              {...a11yProps(1)} 
            />
          </Tabs>
        </Box>

        <TabPanel value={value} index={0}>
          <SalespersonsTab />
        </TabPanel>
        <TabPanel value={value} index={1}>
          <CrewMembersTab />
        </TabPanel>
      </Paper>
    </Box>
  );
};

export default Employees; 