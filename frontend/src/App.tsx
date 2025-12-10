import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import theme from './theme/theme';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import DashboardLayout from './layouts/DashboardLayout';
import FollowUpLayout from './layouts/FollowUpLayout';
import PublicLayout from './layouts/PublicLayout';
import Dashboard from './pages/Dashboard';
import Estimates from './pages/Estimates';
import Jobs from './pages/Jobs';
import Employees from './pages/Employees';
import EmployeeRegistration from './pages/EmployeeRegistration';
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import TelegramGroups from './pages/TelegramGroups'; // Importar nueva página
import InspectionReports from './pages/InspectionReports'; // Nueva página
import Performance from './pages/Performance'; // Nueva página
import FollowUpEstimates from './pages/FollowUpEstimates'; // Módulo Follow-up
import Inbox from './pages/Inbox'; // Inbox
import BranchConfiguration from './pages/BranchConfiguration'; // Módulo Follow-up - Configuration
import SmsBatches from './pages/SmsBatches'; // SMS Batches
import CreateSmsBatch from './pages/CreateSmsBatch'; // Create SMS Batch
import SmsBatchDetail from './pages/SmsBatchDetail'; // SMS Batch Detail
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider maxSnack={3}>
        <AuthProvider>
          <ErrorBoundary>
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
                  <ProtectedRoute allowedRoles={['admin', 'office_manager']}>
                    <Employees />
                  </ProtectedRoute>
                } />
                <Route path="inspection-reports" element={
                  <ProtectedRoute allowedRoles={['admin', 'office_manager']}>
                    <InspectionReports />
                  </ProtectedRoute>
                } />
                <Route path="performance" element={
                  <ProtectedRoute allowedRoles={['admin', 'office_manager']}>
                    <Performance />
                  </ProtectedRoute>
                } />
                <Route path="notifications" element={<Notifications />} />
                <Route path="settings" element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <Settings />
                  </ProtectedRoute>
                } />
                <Route path="settings/telegram-groups" element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <TelegramGroups />
                  </ProtectedRoute>
                } />
                <Route path="profile" element={<Profile />} />
              </Route>
              <Route path="/" element={
                <ProtectedRoute>
                  <Navigate to="/dashboard" replace />
                </ProtectedRoute>
              } />
              {/* Ruta pública para registro de empleados */}
              <Route path="/employee-registration" element={
                <PublicLayout title="Employee Registration" showLoginButton={true}>
                  <EmployeeRegistration />
                </PublicLayout>
              } />
              
              {/* Módulo Follow-up (independiente del dashboard principal) */}
              <Route
                path="/follow-up"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'office_manager']}>
                    <FollowUpLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/follow-up/inbox" replace />} />
                <Route path="inbox" element={<Inbox />} />
                <Route path="estimates" element={<FollowUpEstimates />} />
                <Route path="sms-batches" element={<SmsBatches />} />
                <Route path="sms-batches/create" element={<CreateSmsBatch />} />
                <Route path="sms-batches/:id" element={<SmsBatchDetail />} />
                <Route path="sms-batches/:id/edit" element={<CreateSmsBatch />} />
                <Route path="configuration" element={<BranchConfiguration />} />
              </Route>

              {/* Ruta catch-all para prevenir acceso no autorizado */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
            </Router>
          </ErrorBoundary>
        </AuthProvider>
      </SnackbarProvider>
    </ThemeProvider>
  );
}

export default App;
