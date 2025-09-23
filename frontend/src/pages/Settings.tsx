import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper
} from '@mui/material';
import {
  Business as BranchIcon,
  Label as StatusIcon,
  AccountCircle as UserIcon,
  Settings as ConfigIcon,
  Notifications as NotificationsIcon,
  TableChart as ColumnMapIcon,
  Telegram as TelegramIcon // Nuevo icono
} from '@mui/icons-material';

// Import tab components
import BranchesTab from '../components/settings/BranchesTab';
import StatusesTab from '../components/settings/StatusesTab';
import UsersTab from '../components/settings/UsersTab';
import SystemConfigTab from '../components/settings/SystemConfigTab';
import NotificationsTab from '../components/settings/NotificationsTab';
import ColumnMapManager from '../components/settings/ColumnMapManager';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `settings-tab-${index}`,
    'aria-controls': `settings-tabpanel-${index}`,
  };
}

const Settings = () => {
  const [value, setValue] = useState(0);
  const navigate = useNavigate();

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    // Si la pestaña es la de Telegram Groups, navegar. Si no, cambiar el estado.
    if (tabs[newValue].navigate) {
      navigate(tabs[newValue].navigate as string);
    } else {
      setValue(newValue);
    }
  };

  const tabs = [
    {
      label: 'Branches',
      icon: <BranchIcon />,
      component: <BranchesTab />
    },
    {
      label: 'Statuses',
      icon: <StatusIcon />,
      component: <StatusesTab />
    },
    {
      label: 'Users',
      icon: <UserIcon />,
      component: <UsersTab />
    },
    {
      label: 'Column Maps',
      icon: <ColumnMapIcon />,
      component: <ColumnMapManager />
    },
    {
      label: 'Notifications',
      icon: <NotificationsIcon />,
      component: <NotificationsTab />
    },
    {
      label: 'Telegram Groups', // Nueva pestaña
      icon: <TelegramIcon />,
      navigate: '/dashboard/settings/telegram-groups'
    },
    {
      label: 'System',
      icon: <ConfigIcon />,
      component: <SystemConfigTab />
    }
  ];

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <ConfigIcon sx={{ mr: 2, fontSize: 32 }} />
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Settings & Administration
        </Typography>
      </Box>

      <Paper sx={{ borderRadius: 2 }}>
        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={value}
            onChange={handleChange}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="settings tabs"
          >
            {tabs.map((tab, index) => (
              <Tab
                key={index}
                icon={tab.icon}
                label={tab.label}
                iconPosition="start"
                {...a11yProps(index)}
                sx={{
                  minHeight: 64,
                  textTransform: 'none',
                  fontSize: '1rem',
                  fontWeight: 500
                }}
              />
            ))}
          </Tabs>
        </Box>

        {/* Tab Panels */}
        {tabs.map((tab, index) => (
          !tab.navigate && (
            <TabPanel key={index} value={value} index={index}>
              {tab.component}
            </TabPanel>
          )
        ))}
      </Paper>
    </Box>
  );
};

export default Settings; 