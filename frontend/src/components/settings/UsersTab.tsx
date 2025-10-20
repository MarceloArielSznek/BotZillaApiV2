import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Avatar,
  FormHelperText
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  AccountCircle as UserIcon,
  AdminPanelSettings as AdminIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import authService from '../../services/authService';
import { API_BASE_URL, API_ENDPOINTS } from '../../config/api';

// Types
interface UserRole {
  id: number;
  name: string;
}

interface User {
  id: number;
  email: string;
  phone?: string;
  telegram_id?: string;
  rol: UserRole;
  branches: Branch[];
}

interface Branch {
  id: number;
  name: string;
}

interface CreateUserData {
  email: string;
  password: string;
  phone?: string;
  telegram_id?: string;
  rol_id: number;
  branch_ids: number[];
}

interface UpdateUserData {
  phone?: string;
  telegram_id?: string;
  rol_id?: number;
  branch_ids?: number[];
}

const UsersTab = () => {
  // Estados principales
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { enqueueSnackbar } = useSnackbar();

  // Estados de paginación
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Estados de filtros
  const [roleFilter, setRoleFilter] = useState<number | ''>('');
  const [branchFilter, setBranchFilter] = useState<number | ''>('');

  // Estados de modales
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Estados de formularios
  const [formData, setFormData] = useState<CreateUserData>({
    email: '',
    password: '',
    phone: '',
    telegram_id: '',
    rol_id: 2, // Default to 'user' role
    branch_ids: []
  });
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [submitLoading, setSubmitLoading] = useState(false);

  // Cargar datos iniciales
  useEffect(() => {
    fetchUsers();
    fetchBranches();
    fetchRoles();
  }, []);

  const checkAuth = () => {
    const token = authService.getToken();
    if (!token) {
      setError('Authentication required');
      return false;
    }
    return true;
  };

  const fetchRoles = async () => {
    if (!checkAuth()) return;
    try {
        const token = authService.getToken();
        const response = await fetch(`${API_BASE_URL}/users/roles`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to load roles');
        const data = await response.json();
        setRoles(data);
    } catch (err: any) {
        enqueueSnackbar(`Error fetching roles: ${err.message}`, { variant: 'error' });
    }
  };

  const fetchBranches = async () => {
    if (!checkAuth()) return;
    try {
        const token = authService.getToken();
        // Assuming there's a branches endpoint, might need adjustment
        const response = await fetch(`${API_BASE_URL}/branches`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to load branches');
        const data = await response.json();
        setBranches(data.branches || []); // Extract the branches array
    } catch (err: any) {
        enqueueSnackbar(`Error fetching branches: ${err.message}`, { variant: 'error' });
    }
  };

  const fetchUsers = async () => {
    if (!checkAuth()) return;

    try {
      setLoading(true);
      setError(null);
      
      const token = authService.getToken();
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.USERS.LIST}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        authService.logout();
        setError('Session expired. Please login again.');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to load users');
      }

      const data = await response.json();
      setUsers(data);
    } catch (error: any) {
      setError('Error loading users: ' + error.message);
      enqueueSnackbar('Failed to load users', { 
        variant: 'error',
        anchorOrigin: { vertical: 'top', horizontal: 'center' }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchUsers();
  };

  // Filtrar usuarios
  const filteredUsers = users.filter(user => {
    // Filtro por rol
    if (roleFilter && user.rol.id !== roleFilter) {
      return false;
    }
    
    // Filtro por branch
    if (branchFilter) {
      const hasBranch = user.branches?.some(b => b.id === branchFilter);
      if (!hasBranch) return false;
    }
    
    return true;
  });

  // Reset página cuando cambian los filtros
  useEffect(() => {
    setPage(0);
  }, [roleFilter, branchFilter]);

  // Funciones de modal
  const openCreateModal = () => {
    setFormData({ email: '', password: '', phone: '', telegram_id: '', rol_id: 2, branch_ids: [] });
    setFormErrors({});
    setCreateModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setFormData({
      email: user.email,
      password: '', // Don't prefill password
      phone: user.phone || '',
      telegram_id: user.telegram_id || '',
      rol_id: user.rol.id,
      branch_ids: user.branches ? user.branches.map(b => b.id) : [] // Defensive check
    });
    setFormErrors({});
    setSelectedUser(user);
    setEditModalOpen(true);
  };

  const openViewModal = (user: User) => {
    setSelectedUser(user);
    setViewModalOpen(true);
  };

  const closeModals = () => {
    setCreateModalOpen(false);
    setEditModalOpen(false);
    setViewModalOpen(false);
    setSelectedUser(null);
    setFormData({ email: '', password: '', phone: '', telegram_id: '', rol_id: 2, branch_ids: [] });
    setFormErrors({});
  };

  // Form validation
  const validateForm = (isEdit = false): boolean => {
    const errors: {[key: string]: string} = {};

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Email is invalid';
    }

    if (!isEdit && !formData.password.trim()) {
      errors.password = 'Password is required';
    } else if (!isEdit && formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    if (formData.phone && !/^\+?[\d\s\-\(\)]+$/.test(formData.phone)) {
      errors.phone = 'Invalid phone format';
    }

    if (formData.telegram_id && !/^@?[a-zA-Z0-9_]+$/.test(formData.telegram_id)) {
      errors.telegram_id = 'Invalid Telegram ID format';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Create user
  const handleCreate = async () => {
    if (!validateForm() || !checkAuth()) return;

    setSubmitLoading(true);
    try {
      const token = authService.getToken();
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.USERS.CREATE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (!response.ok) {
        let errorMessage = 'Failed to create user';
        if (result.errors && Array.isArray(result.errors)) {
            errorMessage = result.errors.map(e => e.msg).join(', ');
        } else if (result.message) {
            errorMessage = result.message;
        }
        throw new Error(errorMessage);
      }
      
      enqueueSnackbar('User created successfully', { variant: 'success' });
      closeModals();
      fetchUsers();
    } catch (error: any) {
      setError(`Error creating user: ${error.message}`);
      enqueueSnackbar(`Error creating user: ${error.message}`, { variant: 'error' });
    } finally {
      setSubmitLoading(false);
    }
  };

  // Update user
  const handleUpdate = async () => {
    if (!validateForm(true) || !selectedUser || !checkAuth()) return;

    setSubmitLoading(true);

    const updatePayload: UpdateUserData = {
      phone: formData.phone,
      telegram_id: formData.telegram_id,
      rol_id: formData.rol_id,
      branch_ids: formData.branch_ids
    };
    
    try {
      const token = authService.getToken();
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.USERS.UPDATE(String(selectedUser.id))}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatePayload)
      });

      const result = await response.json();

      if (!response.ok) {
        let errorMessage = 'Failed to update user';
        if (result.errors && Array.isArray(result.errors)) {
            errorMessage = result.errors.map(e => e.msg).join(', ');
        } else if (result.message) {
            errorMessage = result.message;
        }
        throw new Error(errorMessage);
      }

      enqueueSnackbar('User updated successfully', { variant: 'success' });
      closeModals();
      fetchUsers();
    } catch (error: any) {
      setError(`Error updating user: ${error.message}`);
      enqueueSnackbar(`Error updating user: ${error.message}`, { variant: 'error' });
    } finally {
      setSubmitLoading(false);
    }
  };

  // Delete user
  const handleDelete = async (user: User) => {
    if (!checkAuth()) return;
    if (!window.confirm(`Are you sure you want to delete user ${user.email}?`)) {
      return;
    }

    try {
      const token = authService.getToken();
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.USERS.DELETE(String(user.id))}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({ message: 'Failed to delete user' }));
        throw new Error(result.message || 'Failed to delete user');
      }

      enqueueSnackbar('User deleted successfully', { variant: 'success' });
      fetchUsers();
    } catch (error: any) {
      setError(`Error deleting user: ${error.message}`);
      enqueueSnackbar(`Error deleting user: ${error.message}`, { variant: 'error' });
    }
  };

  const getRoleColor = (roleName: string) => {
    switch (roleName.toLowerCase()) {
      case 'admin':
        return 'error';
      case 'user':
        return 'primary';
      case 'client':
        return 'info';
      default:
        return 'default';
    }
  };

  const getRoleIcon = (roleName: string) => {
    switch (roleName.toLowerCase()) {
      case 'admin':
        return <AdminIcon />;
      default:
        return <UserIcon />;
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <UserIcon sx={{ mr: 1, fontSize: 24 }} />
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
            Users Management
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Tooltip title="Refresh data">
            <IconButton onClick={handleRefresh} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreateModal}
            disabled={loading}
          >
            New User
          </Button>
        </Box>
      </Box>

      {/* Alertas */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Info Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            Manage system users and their access levels. Users can have different roles with varying permissions.
          </Typography>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="subtitle2" sx={{ minWidth: '80px' }}>
              Filters:
            </Typography>
            
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Role</InputLabel>
              <Select
                value={roleFilter}
                label="Role"
                onChange={(e) => setRoleFilter(e.target.value as number | '')}
              >
                <MenuItem value="">
                  <em>All Roles</em>
                </MenuItem>
                {roles.map((role) => (
                  <MenuItem key={role.id} value={role.id}>
                    {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Branch</InputLabel>
              <Select
                value={branchFilter}
                label="Branch"
                onChange={(e) => setBranchFilter(e.target.value as number | '')}
              >
                <MenuItem value="">
                  <em>All Branches</em>
                </MenuItem>
                {branches.map((branch) => (
                  <MenuItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {(roleFilter || branchFilter) && (
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  setRoleFilter('');
                  setBranchFilter('');
                }}
              >
                Clear Filters
              </Button>
            )}

            <Box sx={{ flexGrow: 1 }} />
            
            <Typography variant="body2" color="text.secondary">
              {filteredUsers.length} of {users.length} user{users.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: 'text.primary', fontWeight: 'bold' }}>ID</TableCell>
                      <TableCell sx={{ color: 'text.primary', fontWeight: 'bold' }}>User</TableCell>
                      <TableCell sx={{ color: 'text.primary', fontWeight: 'bold' }}>Contact</TableCell>
                      <TableCell sx={{ color: 'text.primary', fontWeight: 'bold' }}>Role</TableCell>
                      <TableCell sx={{ color: 'text.primary', fontWeight: 'bold' }}>Branches</TableCell>
                      <TableCell align="center" sx={{ color: 'text.primary', fontWeight: 'bold' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">
                            {users.length === 0 ? 'No users found' : 'No users match the selected filters'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((user) => (
                        <TableRow key={user.id} hover>
                          <TableCell>{user.id}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <Avatar sx={{ mr: 2, bgcolor: getRoleColor(user.rol.name) }}>
                                {user.email.charAt(0).toUpperCase()}
                              </Avatar>
                              <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                {user.email}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                              {user.phone && (
                                <Typography variant="body2">{user.phone}</Typography>
                              )}
                              {user.telegram_id && (
                                <Typography variant="body2" color="text.secondary">
                                  {user.telegram_id}
                                </Typography>
                              )}
                              {!user.phone && !user.telegram_id && (
                                <Typography variant="body2" color="text.secondary">
                                  N/A
                                </Typography>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip
                              icon={getRoleIcon(user.rol.name)}
                              label={user.rol.name.charAt(0).toUpperCase() + user.rol.name.slice(1)}
                              color={getRoleColor(user.rol.name)}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {user.branches?.map((branch) => (
                                <Chip key={branch.id} label={branch.name} size="small" />
                              ))}
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                              <Tooltip title="View details">
                                <IconButton
                                  size="small"
                                  onClick={() => openViewModal(user)}
                                  disabled={loading}
                                >
                                  <ViewIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Edit">
                                <IconButton
                                  size="small"
                                  onClick={() => openEditModal(user)}
                                  disabled={loading}
                                >
                                  <EditIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleDelete(user)}
                                  disabled={loading || user.rol.name === 'admin'}
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Pagination */}
              <TablePagination
                component="div"
                count={filteredUsers.length}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
                }}
                rowsPerPageOptions={[5, 10, 25, 50]}
                labelRowsPerPage="Rows per page:"
                labelDisplayedRows={({ from, to, count }) => 
                  `${from}-${to} of ${count !== -1 ? count : 'more than ' + to}`
                }
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Modal */}
      <Dialog open={createModalOpen} onClose={closeModals} maxWidth="sm" fullWidth>
        <DialogTitle>Create New User</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Email *"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              error={!!formErrors.email}
              helperText={formErrors.email}
              disabled={submitLoading}
            />
            <TextField
              fullWidth
              label="Password *"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              error={!!formErrors.password}
              helperText={formErrors.password}
              disabled={submitLoading}
            />
            <TextField
              fullWidth
              label="Phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              error={!!formErrors.phone}
              helperText={formErrors.phone}
              placeholder="+1234567890"
              disabled={submitLoading}
            />
            <TextField
              fullWidth
              label="Telegram ID"
              value={formData.telegram_id}
              onChange={(e) => setFormData({ ...formData, telegram_id: e.target.value })}
              error={!!formErrors.telegram_id}
              helperText={formErrors.telegram_id}
              placeholder="@username"
              disabled={submitLoading}
            />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={formData.rol_id}
                onChange={(e) => setFormData({ ...formData, rol_id: Number(e.target.value) })}
                label="Role"
                disabled={submitLoading}
                error={!!formErrors.rol_id}
              >
                {roles.map((role) => (
                  <MenuItem key={role.id} value={role.id}>
                    {role.name}
                  </MenuItem>
                ))}
              </Select>
              {formErrors.rol_id && <FormHelperText>{formErrors.rol_id}</FormHelperText>}
            </FormControl>

            <FormControl fullWidth margin="dense">
              <InputLabel id="branches-select-label">Branches</InputLabel>
              <Select
                labelId="branches-select-label"
                multiple
                value={formData.branch_ids}
                onChange={(e) => setFormData({ ...formData, branch_ids: e.target.value as number[] })}
                label="Branches"
              >
                {branches.map((branch) => (
                  <MenuItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeModals} disabled={submitLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreate} 
            variant="contained" 
            disabled={submitLoading}
            startIcon={submitLoading ? <CircularProgress size={20} /> : null}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={editModalOpen} onClose={closeModals} maxWidth="sm" fullWidth>
        <DialogTitle>Edit User</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={formData.email}
              disabled // Email shouldn't be editable
              helperText="Email cannot be changed"
            />
            <TextField
              fullWidth
              label="Phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              error={!!formErrors.phone}
              helperText={formErrors.phone}
              placeholder="+1234567890"
              disabled={submitLoading}
            />
            <TextField
              fullWidth
              label="Telegram ID"
              value={formData.telegram_id}
              onChange={(e) => setFormData({ ...formData, telegram_id: e.target.value })}
              error={!!formErrors.telegram_id}
              helperText={formErrors.telegram_id}
              placeholder="@username"
              disabled={submitLoading}
            />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={formData.rol_id}
                onChange={(e) => setFormData({ ...formData, rol_id: Number(e.target.value) })}
                label="Role"
                disabled={submitLoading}
              >
                {roles.map((role) => (
                  <MenuItem key={role.id} value={role.id}>
                    {role.name}
                  </MenuItem>
                ))}
              </Select>
              {formErrors.rol_id && <FormHelperText>{formErrors.rol_id}</FormHelperText>}
            </FormControl>

            <FormControl fullWidth margin="dense">
              <InputLabel id="branches-select-label">Branches</InputLabel>
              <Select
                labelId="branches-select-label"
                multiple
                value={formData.branch_ids}
                onChange={(e) => setFormData({ ...formData, branch_ids: e.target.value as number[] })}
                label="Branches"
              >
                {branches.map((branch) => (
                  <MenuItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeModals} disabled={submitLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpdate} 
            variant="contained" 
            disabled={submitLoading}
            startIcon={submitLoading ? <CircularProgress size={20} /> : null}
          >
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Modal */}
      <Dialog open={viewModalOpen} onClose={closeModals} maxWidth="sm" fullWidth>
        <DialogTitle>User Details</DialogTitle>
        <DialogContent>
          {selectedUser && (
            <Box sx={{ pt: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Avatar sx={{ mr: 2, width: 64, height: 64 }}>
                  {selectedUser.email.charAt(0).toUpperCase()}
                </Avatar>
                <Box>
                  <Typography variant="h6">
                    {selectedUser.email}
                  </Typography>
                  <Chip
                    icon={getRoleIcon(selectedUser.rol.name)}
                    label={selectedUser.rol.name.charAt(0).toUpperCase() + selectedUser.rol.name.slice(1)}
                    color={getRoleColor(selectedUser.rol.name)}
                    variant="outlined"
                    sx={{ mt: 1 }}
                  />
                </Box>
              </Box>

              <Typography variant="h6" sx={{ mb: 2 }}>Contact Information</Typography>
              <Box sx={{ mb: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography>
                  <strong>Phone:</strong> {selectedUser.phone || 'N/A'}
                </Typography>
                <Typography>
                  <strong>Telegram:</strong> {selectedUser.telegram_id || 'N/A'}
                </Typography>
              </Box>

              <Typography variant="h6" sx={{ mb: 2 }}>User ID</Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedUser.id}
              </Typography>

              <Typography variant="h6" sx={{ mt: 3 }}>Assigned Branches</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                  {selectedUser?.branches?.length > 0 ? (
                      selectedUser.branches.map(branch => (
                          <Chip key={branch.id} label={branch.name} />
                      ))
                  ) : (
                      <Typography variant="body2" color="text.secondary">No branches assigned.</Typography>
                  )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeModals}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UsersTab; 