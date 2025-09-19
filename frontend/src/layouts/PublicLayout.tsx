import React from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Paper
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { Login as LoginIcon, Home as HomeIcon } from '@mui/icons-material';

interface PublicLayoutProps {
  children: React.ReactNode;
  title?: string;
  showLoginButton?: boolean;
}

const PublicLayout: React.FC<PublicLayoutProps> = ({ 
  children, 
  title = "BotZilla", 
  showLoginButton = true 
}) => {
  const theme = useTheme();
  const navigate = useNavigate();

  const handleLoginClick = () => {
    navigate('/login');
  };

  const handleHomeClick = () => {
    navigate('/');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <AppBar position="static" elevation={1} sx={{ bgcolor: 'background.paper', color: 'text.primary', borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar>
          {/* Logo y título */}
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            <Box
              component="img"
              src="/botzilla-logo.png"
              alt="BotZilla"
              sx={{ 
                height: 40,
                width: 40,
                mr: 2,
                cursor: 'pointer'
              }}
              onClick={handleHomeClick}
            />
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: 600,
                cursor: 'pointer'
              }}
              onClick={handleHomeClick}
            >
              {title}
            </Typography>
          </Box>

          {/* Botones de navegación */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            {showLoginButton && (
              <Button
                startIcon={<LoginIcon />}
                onClick={handleLoginClick}
                variant="contained"
                size="small"
              >
                Staff Login
              </Button>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Contenido principal */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minHeight: 'calc(100vh - 64px)', // Altura total menos el AppBar
          py: { xs: 2, sm: 3 },
          px: { xs: 0, sm: 2 }
        }}
      >
        <Container maxWidth="md" sx={{ px: { xs: 0, sm: 3 } }}>
          {children}
        </Container>
      </Box>

      {/* Footer */}
      <Paper 
        component="footer" 
        elevation={0}
        sx={{ 
          py: 2, 
          px: 3, 
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider'
        }}
      >
        <Container maxWidth="md">
          <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: { xs: 'center', sm: 'space-between' }, 
            alignItems: 'center',
            textAlign: { xs: 'center', sm: 'left' },
            gap: { xs: 1, sm: 2 }
          }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
              © {new Date().getFullYear()} BotZilla. All rights reserved.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
              Need help? Contact HR at hr@company.com
            </Typography>
          </Box>
        </Container>
      </Paper>
    </Box>
  );
};

export default PublicLayout;
