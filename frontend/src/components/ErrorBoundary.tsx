import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Alert } from '@mui/material';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Solo mostrar error boundary para errores reales, no de navegación
    if (error.message.includes('canceled') || 
        error.message.includes('hooks') ||
        error.message.includes('navigation')) {
      return { hasError: false };
    }
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log solo errores importantes
    if (!error.message.includes('canceled') && 
        !error.message.includes('hooks') &&
        !error.message.includes('navigation')) {
      console.error('Error Boundary caught an error:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Oops! Something went wrong
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {this.state.error?.message || 'An unexpected error occurred'}
            </Typography>
          </Alert>
          <Button 
            variant="contained" 
            onClick={() => window.location.reload()}
          >
            Reload Page
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
