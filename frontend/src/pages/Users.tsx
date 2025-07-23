import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { motion } from 'framer-motion';
import { useSnackbar } from 'notistack';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';
import authService from '../services/authService';

interface User {
  id: number;
  email: string;
  phone: string;
  telegram_id: string;
  rol: {
    id: number;
    name: string;
  };
}

interface EditUserData {
  id: number;
  email: string;
  phone: string;
  telegram_id: string;
  rol_id: string;
  password?: string;
}

const Users = () => {
  const [open, setOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedUser, setSelectedUser] = useState<EditUserData | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();

  const checkAuth = () => {
    const token = authService.getToken();
    if (!token) {
      navigate('/login');
      return false;
    }
    return true;
  };

  const fetchUsers = async () => {
    if (!checkAuth()) return;

    try {
      console.log('Fetching users...');
      const token = authService.getToken();
      console.log('Using token:', token);

      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.USERS.LIST}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('Users API Response:', response);
      if (response.status === 401) {
        // Token expired or invalid
        authService.logout();
        navigate('/login');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        throw new Error(errorData.message || 'Failed to load users');
      }

      const data = await response.json();
      console.log('Users data:', data);
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
      enqueueSnackbar('Failed to load users', { 
        variant: 'error',
        anchorOrigin: { vertical: 'top', horizontal: 'center' }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    setSelectedUser({
      id: user.id,
      email: user.email,
      phone: user.phone,
      telegram_id: user.telegram_id,
      rol_id: user.rol.id.toString()
    });
    setEditMode(true);
    setOpen(true);
  };

  const handleDelete = async (userId: number) => {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      const token = authService.getToken();
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.USERS.DELETE(userId.toString())}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        authService.logout();
        navigate('/login');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete user');
      }

      enqueueSnackbar('User deleted successfully', {
        variant: 'success',
        anchorOrigin: { vertical: 'top', horizontal: 'center' }
      });

      await fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      enqueueSnackbar(error.message || 'Failed to delete user', {
        variant: 'error',
        anchorOrigin: { vertical: 'top', horizontal: 'center' }
      });
    }
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setEditMode(false);
    setSelectedUser(null);
  };

  useEffect(() => {
    if (checkAuth()) {
      fetchUsers();
    }
  }, []);

  const formik = useFormik({
    initialValues: {
      email: '',
      password: '',
      phone: '',
      telegram_id: '',
      rol_id: '2',
    },
    validationSchema: Yup.object().shape({
      email: Yup.string()
        .email('Invalid email address')
        .required('Email is required'),
      password: Yup.string()
        .test('password-validation', 'Invalid password', function(value) {
          if (editMode && !value) {
            return true;
          }
          if (!editMode || value) {
            if (!value) return false;
            const isValid = value.length >= 6 && /\d/.test(value);
            return isValid || this.createError({
              message: 'Password must be at least 6 characters and contain at least one number'
            });
          }
          return true;
        }),
      phone: Yup.string()
        .matches(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number')
        .required('Phone is required'),
      telegram_id: Yup.string()
        .required('Telegram ID is required'),
      rol_id: Yup.string()
        .required('Role is required'),
    }),
    onSubmit: async (values, { resetForm, setSubmitting }) => {
      if (!checkAuth()) return;

      try {
        console.log('Submitting user data:', values);
        const token = authService.getToken();

        const url = editMode 
          ? `${API_BASE_URL}${API_ENDPOINTS.USERS.UPDATE(selectedUser!.id.toString())}`
          : `${API_BASE_URL}${API_ENDPOINTS.USERS.CREATE}`;

        const response = await fetch(url, {
          method: editMode ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            email: values.email,
            ...(values.password && { password: values.password }),
            phone: values.phone,
            telegram_id: values.telegram_id,
            rol_id: parseInt(values.rol_id)
          })
        });

        if (response.status === 401) {
          authService.logout();
          navigate('/login');
          return;
        }

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Failed to ${editMode ? 'update' : 'create'} user`);
        }

        const data = await response.json();
        console.log(`${editMode ? 'Updated' : 'Created'} user data:`, data);
        
        await fetchUsers();
        
        enqueueSnackbar(`User ${editMode ? 'updated' : 'created'} successfully`, { 
          variant: 'success',
          anchorOrigin: { vertical: 'top', horizontal: 'center' }
        });

        handleCloseDialog();
        resetForm();
      } catch (error: any) {
        console.error(`Error ${editMode ? 'updating' : 'creating'} user:`, error);
        enqueueSnackbar(error.message || `Failed to ${editMode ? 'update' : 'create'} user`, { 
          variant: 'error',
          anchorOrigin: { vertical: 'top', horizontal: 'center' }
        });
      } finally {
        setSubmitting(false);
      }
    },
    enableReinitialize: true
  });

  useEffect(() => {
    if (selectedUser) {
      formik.setValues({
        email: selectedUser.email,
        password: '',
        phone: selectedUser.phone,
        telegram_id: selectedUser.telegram_id,
        rol_id: selectedUser.rol_id
      });
    }
  }, [selectedUser]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" color="primary" sx={{ fontWeight: 600 }}>
          Users
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpen(true)}
          sx={{
            background: 'linear-gradient(45deg, #FF6B6B 30%, #4ECB71 90%)',
            boxShadow: '0 3px 5px 2px rgba(255, 105, 135, .3)',
          }}
        >
          New User
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Telegram ID</TableCell>
              <TableCell>Role</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.phone}</TableCell>
                <TableCell>{user.telegram_id}</TableCell>
                <TableCell>{user.rol.name}</TableCell>
                <TableCell align="right">
                  <IconButton 
                    color="primary"
                    onClick={() => handleEdit(user)}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton 
                    color="error"
                    onClick={() => handleDelete(user.id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  No users found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog 
        open={open} 
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{editMode ? 'Edit User' : 'Create New User'}</DialogTitle>
        <form onSubmit={formik.handleSubmit}>
          <DialogContent dividers>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <TextField
                fullWidth
                id="email"
                name="email"
                label="Email"
                value={formik.values.email}
                onChange={formik.handleChange}
                error={formik.touched.email && Boolean(formik.errors.email)}
                helperText={formik.touched.email && formik.errors.email}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                id="password"
                name="password"
                label={editMode ? 'New Password (optional)' : 'Password'}
                type="password"
                value={formik.values.password}
                onChange={formik.handleChange}
                error={formik.touched.password && Boolean(formik.errors.password)}
                helperText={formik.touched.password && formik.errors.password}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                id="phone"
                name="phone"
                label="Phone"
                value={formik.values.phone}
                onChange={formik.handleChange}
                error={formik.touched.phone && Boolean(formik.errors.phone)}
                helperText={formik.touched.phone && formik.errors.phone}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                id="telegram_id"
                name="telegram_id"
                label="Telegram ID"
                value={formik.values.telegram_id}
                onChange={formik.handleChange}
                error={formik.touched.telegram_id && Boolean(formik.errors.telegram_id)}
                helperText={formik.touched.telegram_id && formik.errors.telegram_id}
                sx={{ mb: 2 }}
              />
              <FormControl fullWidth>
                <InputLabel id="rol-label">Role</InputLabel>
                <Select
                  labelId="rol-label"
                  id="rol_id"
                  name="rol_id"
                  value={formik.values.rol_id}
                  onChange={formik.handleChange}
                  error={formik.touched.rol_id && Boolean(formik.errors.rol_id)}
                >
                  <MenuItem value="1">Admin</MenuItem>
                  <MenuItem value="2">User</MenuItem>
                  <MenuItem value="3">Client</MenuItem>
                </Select>
              </FormControl>
            </motion.div>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button
              onClick={handleCloseDialog}
              variant="outlined"
              color="primary"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={formik.isSubmitting}
              sx={{
                background: 'linear-gradient(45deg, #FF6B6B 30%, #4ECB71 90%)',
                boxShadow: '0 3px 5px 2px rgba(255, 105, 135, .3)',
              }}
            >
              {editMode ? 'Update User' : 'Create User'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default Users; 