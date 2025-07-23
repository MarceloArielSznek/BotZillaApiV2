import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#4CAF50', // Verde BotZilla
      light: '#81C784',
      dark: '#388E3C',
    },
    secondary: {
      main: '#FF9800', // Naranja BotZilla
      light: '#FFB74D',
      dark: '#F57C00',
    },
    background: {
      default: '#1A1C1E',
      paper: '#2D2F31',
    },
    error: {
      main: '#F44336',
    },
    warning: {
      main: '#FFA726',
    },
    success: {
      main: '#66BB6A',
    },
  },
  typography: {
    fontFamily: '"Poppins", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontFamily: '"Poppins", "Roboto", "Helvetica", "Arial", sans-serif',
      fontSize: '2rem',
      fontWeight: 600,
    },
    h6: {
      fontFamily: '"Poppins", "Roboto", "Helvetica", "Arial", sans-serif',
      fontSize: '1.1rem',
      fontWeight: 500,
    },
    button: {
      fontFamily: '"Poppins", "Roboto", "Helvetica", "Arial", sans-serif',
      fontSize: '0.875rem',
      fontWeight: 500,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#2D2F31',
          borderRight: '1px solid rgba(255, 255, 255, 0.05)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#2D2F31',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#2D2F31',
          backgroundImage: 'none',
        },
      },
    },
  },
});

export default theme; 