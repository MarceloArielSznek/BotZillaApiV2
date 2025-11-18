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
  Tooltip,
} from '@mui/material';
import {
  Assessment as EstimatesIcon,
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  AccountCircle as AccountIcon,
  Logout as LogoutIcon,
  TrendingUp as FollowUpIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DRAWER_WIDTH = 250;
const DRAWER_WIDTH_COLLAPSED = 70;

const FollowUpLayout = () => {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    handleCloseMenu();
  };

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  const menuItems = [
    { text: 'Estimates', icon: <EstimatesIcon />, path: '/follow-up/estimates' },
    { text: 'Configuration', icon: <SettingsIcon />, path: '/follow-up/configuration' },
    // Agregar más opciones del módulo follow-up aquí en el futuro
  ];

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header del sidebar */}
      <Box 
        sx={{ 
          p: 2, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          minHeight: drawerOpen ? 180 : 100,
          justifyContent: 'center'
        }}
      >
        <Box
          component="img"
          src="/botzilla-logo.png"
          alt="BotZilla Follow-Ups"
          sx={{ 
            height: drawerOpen ? 100 : 50,
            width: drawerOpen ? 100 : 50,
            mb: 1,
          }}
        />
        {drawerOpen && (
          <Typography 
            variant="h6" 
            sx={{ 
              fontWeight: 700,
              color: theme.palette.primary.main,
              textAlign: 'center'
            }}
          >
            Follow-Ups
          </Typography>
        )}
      </Box>

      <Divider />

      {/* Menu items */}
      <List sx={{ flexGrow: 1, pt: 2 }}>
        {menuItems.map((item) => (
          <Tooltip 
            key={item.text} 
            title={!drawerOpen ? item.text : ''} 
            placement="right"
            arrow
          >
            <ListItemButton
              onClick={() => navigate(item.path)}
              selected={location.pathname === item.path}
              sx={{
                justifyContent: drawerOpen ? 'initial' : 'center',
                px: 2.5,
                py: 1.5,
                mb: 0.5,
                mx: 1,
                borderRadius: 1,
                '&.Mui-selected': {
                  backgroundColor: 'rgba(76, 175, 80, 0.08)',
                  color: theme.palette.primary.main,
                  '&:hover': {
                    backgroundColor: 'rgba(76, 175, 80, 0.12)',
                  },
                  '& .MuiListItemIcon-root': {
                    color: theme.palette.primary.main,
                  },
                },
                '&:hover': {
                  backgroundColor: 'rgba(76, 175, 80, 0.04)',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: drawerOpen ? 2 : 'auto',
                  justifyContent: 'center',
                }}
              >
                {item.icon}
              </ListItemIcon>
              {drawerOpen && <ListItemText primary={item.text} />}
            </ListItemButton>
          </Tooltip>
        ))}
      </List>

      <Divider />

      {/* Back to Dashboard button */}
      <Box sx={{ p: 1 }}>
        <Tooltip title={!drawerOpen ? 'Back to BotZilla' : ''} placement="right" arrow>
          <IconButton
            onClick={handleBackToDashboard}
            size="small"
            sx={{
              width: '100%',
              justifyContent: drawerOpen ? 'flex-start' : 'center',
              borderRadius: 1,
              py: 0.5,
              '&:hover': {
                backgroundColor: 'rgba(76, 175, 80, 0.08)',
              },
            }}
          >
            <ChevronLeftIcon fontSize="small" />
            {drawerOpen && (
              <Typography 
                variant="caption" 
                sx={{ 
                  ml: 1,
                  fontSize: '0.75rem',
                  color: 'text.secondary',
                }}
              >
                Back to BotZilla
              </Typography>
            )}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* AppBar */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerOpen ? DRAWER_WIDTH : DRAWER_WIDTH_COLLAPSED}px)` },
          ml: { md: `${drawerOpen ? DRAWER_WIDTH : DRAWER_WIDTH_COLLAPSED}px` },
          transition: theme.transitions.create(['margin', 'width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="toggle drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2 }}
          >
            {drawerOpen ? <ChevronLeftIcon /> : <MenuIcon />}
          </IconButton>

          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Lost Estimates Follow-Up
          </Typography>

          {/* User menu */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
              {(user as any)?.name || user?.email}
            </Typography>
            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleMenu}
              color="inherit"
            >
              <AccountIcon />
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              anchorOrigin={{
                vertical: 'top',
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
              <MenuItem onClick={handleLogout}>
                <ListItemIcon>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Logout</ListItemText>
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Drawer / Sidebar */}
      <Box
        component="nav"
        sx={{
          width: { md: drawerOpen ? DRAWER_WIDTH : DRAWER_WIDTH_COLLAPSED },
          flexShrink: { md: 0 },
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        {isMobile ? (
          <Drawer
            variant="temporary"
            open={drawerOpen}
            onClose={handleDrawerToggle}
            ModalProps={{
              keepMounted: true,
            }}
            sx={{
              '& .MuiDrawer-paper': {
                boxSizing: 'border-box',
                width: DRAWER_WIDTH,
              },
            }}
          >
            {drawer}
          </Drawer>
        ) : (
          <Drawer
            variant="permanent"
            sx={{
              '& .MuiDrawer-paper': {
                boxSizing: 'border-box',
                width: drawerOpen ? DRAWER_WIDTH : DRAWER_WIDTH_COLLAPSED,
                transition: theme.transitions.create('width', {
                  easing: theme.transitions.easing.sharp,
                  duration: theme.transitions.duration.enteringScreen,
                }),
                overflowX: 'hidden',
              },
            }}
            open
          >
            {drawer}
          </Drawer>
        )}
      </Box>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          pt: 10,
          width: { md: `calc(100% - ${drawerOpen ? DRAWER_WIDTH : DRAWER_WIDTH_COLLAPSED}px)` },
          minHeight: '100vh',
          backgroundColor: theme.palette.background.default,
          transition: theme.transitions.create(['margin', 'width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default FollowUpLayout;

