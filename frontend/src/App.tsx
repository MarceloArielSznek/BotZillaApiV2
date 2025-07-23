import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import theme from './theme/theme';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Estimates from './pages/Estimates';
import Jobs from './pages/Jobs';
import Employees from './pages/Employees';
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider maxSnack={3}>
        <AuthProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="main" element={<Dashboard />} />
                <Route path="estimates" element={<Estimates />} />
                <Route path="jobs" element={<Jobs />} />
                <Route path="employees" element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <Employees />
                  </ProtectedRoute>
                } />
                <Route path="notifications" element={<Notifications />} />
                <Route path="settings" element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <Settings />
                  </ProtectedRoute>
                } />
                <Route path="profile" element={<Profile />} />
              </Route>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Router>
        </AuthProvider>
      </SnackbarProvider>
    </ThemeProvider>
  );
}

export default App;
