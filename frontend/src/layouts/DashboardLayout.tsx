import React, { useState } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  useTheme,
  useMediaQuery,
  Divider,
  Menu,
  MenuItem,
  Button,
  Tooltip,
} from '@mui/material';
import {
  Assessment as EstimatesIcon,
  Work as JobsIcon,
  People as EmployeesIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  AccountCircle as AccountIcon,
  HelpOutline as HelpIcon,
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DRAWER_WIDTH = 250;

const DashboardLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const handleViewProfile = () => {
    navigate('/dashboard/profile');
    handleCloseMenu();
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    handleCloseMenu();
  };

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { text: 'Estimates', icon: <EstimatesIcon />, path: '/dashboard/estimates' },
    { text: 'Jobs', icon: <JobsIcon />, path: '/dashboard/jobs' },
    { text: 'Employees', icon: <EmployeesIcon />, path: '/dashboard/employees' },
    { text: 'Notifications', icon: <NotificationsIcon />, path: '/dashboard/notifications' },
    { text: 'Settings', icon: <SettingsIcon />, path: '/dashboard/settings' },
  ];

  const drawer = (
    <>
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Box
          component="img"
          src="/botzilla-logo.png"
          alt="BotZilla"
          sx={{ 
            height: isMobile ? 60 : 140,
            width: isMobile ? 60 : 140,
            mb: 1,
          }}
        />
        <Typography 
          variant="h5" 
          sx={{ 
            fontWeight: 600,
            fontSize: isMobile ? '1.2rem' : '1.8rem'
          }}
        >
          BotZilla
        </Typography>
      </Box>
      <Divider />
      <List sx={{ flex: 1, px: 1, py: 2 }}>
        {menuItems.map((item) => (
          <ListItemButton
            key={item.text}
            onClick={() => {
              navigate(item.path);
              if (isMobile) setMobileOpen(false);
            }}
            selected={location.pathname === item.path}
            sx={{
              my: 0.5,
              borderRadius: 1,
              minHeight: 48,
              px: 2,
              '&.Mui-selected': {
                bgcolor: 'rgba(76, 175, 80, 0.08)',
              },
              '&:hover': {
                bgcolor: 'rgba(76, 175, 80, 0.04)',
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText primary={item.text} />
          </ListItemButton>
        ))}
      </List>
      <Divider />
      <Box sx={{ p: 2 }}>
        <Button
          variant="outlined"
          fullWidth
          startIcon={<HelpIcon />}
          sx={{
            py: 1,
            color: 'text.secondary',
            borderColor: 'divider',
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: 'rgba(76, 175, 80, 0.04)',
            },
          }}
        >
          Solicitar Ayuda
        </Button>
      </Box>
    </>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: DRAWER_WIDTH },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }} />
          <IconButton
            size="large"
            onClick={handleMenu}
            color="inherit"
          >
            <AccountIcon />
          </IconButton>
          <Menu
            id="menu-appbar"
            anchorEl={anchorEl}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={Boolean(anchorEl)}
            onClose={handleCloseMenu}
          >
                          <MenuItem onClick={handleViewProfile}>View Profile</MenuItem>
            <MenuItem onClick={handleLogout}>Logout</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}
      >
        {/* Drawer móvil */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Mejor rendimiento en móviles
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
            },
          }}
        >
          {drawer}
        </Drawer>
        
        {/* Drawer desktop */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          mt: { xs: 7, sm: 8 },
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default DashboardLayout; 