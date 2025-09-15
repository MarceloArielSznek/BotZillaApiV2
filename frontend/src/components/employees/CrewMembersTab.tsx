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
  FormControlLabel,
  Switch,
  Autocomplete
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Construction as CrewIcon,
  Phone as PhoneIcon,
  Telegram as TelegramIcon,
  Business as BusinessIcon,
  Star as LeaderIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import crewService, { 
  type CrewMember, 
  type CrewMemberListParams, 
  type CreateCrewMemberData,
  type Branch
} from '../../services/crewService';
import branchService from '../../services/branchService';

const CrewMembersTab = () => {
  // Estados principales
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Estados de paginación
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // Estados de filtros
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [leaderFilter, setLeaderFilter] = useState<string>('');

  // Estados de modales
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedCrewMember, setSelectedCrewMember] = useState<CrewMember | null>(null);

  // Estados de formularios
  const [formData, setFormData] = useState<CreateCrewMemberData>({
    name: '',
    phone: '',
    telegram_id: '',
    is_leader: false,
    branchIds: [],
    animal: ''
  });
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [submitLoading, setSubmitLoading] = useState(false);

  // Cargar datos
  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    // Agregar un pequeño delay para la carga inicial
    const timeoutId = setTimeout(() => {
      loadCrewMembers();
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [page, rowsPerPage, search, branchFilter, leaderFilter]);

  const loadBranches = async () => {
    try {
      const response = await branchService.getBranches({ includeStats: false });
      setBranches(response.branches);
    } catch (error: any) {
      console.error('Error loading branches:', error);
    }
  };

  const loadCrewMembers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params: CrewMemberListParams = {
        page: page + 1,
        limit: rowsPerPage,
        search: search || undefined,
        branchId: branchFilter ? parseInt(branchFilter) : undefined,
        isLeader: leaderFilter ? leaderFilter === 'true' : undefined,
        includeStats: true // Incluir estadísticas de branches
      };

      const response = await crewService.getCrewMembers(params);
      console.log('🏢 Frontend - Crew members recibidos:', response.crewMembers.map(cm => ({
        id: cm.id,
        name: cm.name,
        branchesCount: cm.stats?.branchesCount || 0,
        hasStats: !!cm.stats
      })));
      setCrewMembers(response.crewMembers);
      setTotalCount(response.pagination.totalCount);
    } catch (error: any) {
      console.error('Error loading crew members:', error);
      if (error.code === 'ERR_NETWORK') {
        setError('No se pudo conectar al servidor. Verifique que el backend esté ejecutándose en el puerto 3000.');
      } else if (error.response?.status === 401) {
        setError('Su sesión ha expirado. Por favor, inicie sesión nuevamente.');
      } else if (error.response?.status === 403) {
        setError('No tiene permisos para acceder a esta información.');
      } else {
        setError('Error loading crew members: ' + (error.response?.data?.message || error.message));
      }
      setCrewMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  const handleRefresh = async () => {
    try {
      // Limpiar cache de crew members
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/cache/clear-crew-members`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Recargar crew members
      loadCrewMembers();
    } catch (error) {
      console.error('Error clearing cache:', error);
      // Si falla la limpieza de cache, al menos recargar los datos
      loadCrewMembers();
    }
  };

  // Funciones de modal
  const openCreateModal = () => {
    setFormData({ name: '', phone: '', telegram_id: '', is_leader: false, branchIds: [], animal: '' });
    setFormErrors({});
    setCreateModalOpen(true);
  };

  const openEditModal = (crewMember: CrewMember) => {
    setFormData({
      name: crewMember.name,
      phone: crewMember.phone || '',
      telegram_id: crewMember.telegram_id || '',
      is_leader: crewMember.is_leader,
      branchIds: crewMember.branches?.map(branch => branch.id) || [],
      animal: crewMember.animal || ''
    });
    setFormErrors({});
    setSelectedCrewMember(crewMember);
    setEditModalOpen(true);
  };

  const openViewModal = async (crewMember: CrewMember) => {
    try {
      setLoading(true);
      const fullCrewMember = await crewService.getCrewMemberById(crewMember.id);
      setSelectedCrewMember(fullCrewMember);
      setViewModalOpen(true);
    } catch (error: any) {
      setError('Error loading crew member details: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const closeModals = () => {
    setCreateModalOpen(false);
    setEditModalOpen(false);
    setViewModalOpen(false);
    setSelectedCrewMember(null);
    setFormData({ name: '', phone: '', telegram_id: '', is_leader: false, branchIds: [], animal: '' });
    setFormErrors({});
  };

  // Form validation
  const validateForm = (): boolean => {
    const errors: {[key: string]: string} = {};

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
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

  // Create crew member
  const handleCreate = async () => {
    if (!validateForm()) return;

    try {
      setSubmitLoading(true);
      await crewService.createCrewMember(formData);
      setSuccess('Crew member created successfully');
      closeModals();
      loadCrewMembers();
    } catch (error: any) {
      setError('Error creating crew member: ' + (error.response?.data?.message || error.message));
    } finally {
      setSubmitLoading(false);
    }
  };

  // Update crew member
  const handleUpdate = async () => {
    if (!validateForm() || !selectedCrewMember) return;

    try {
      setSubmitLoading(true);
      await crewService.updateCrewMember(selectedCrewMember.id, formData);
      setSuccess('Crew member updated successfully');
      closeModals();
      loadCrewMembers();
    } catch (error: any) {
      setError('Error updating crew member: ' + (error.response?.data?.message || error.message));
    } finally {
      setSubmitLoading(false);
    }
  };

  // Delete crew member
  const handleDelete = async (crewMember: CrewMember) => {
    if (!window.confirm(`Are you sure you want to delete the crew member "${crewMember.name}"?`)) {
      return;
    }

    try {
      setLoading(true);
      await crewService.deleteCrewMember(crewMember.id);
      setSuccess('Crew member deleted successfully');
      loadCrewMembers();
    } catch (error: any) {
      setError('Error deleting crew member: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <CrewIcon sx={{ mr: 1, fontSize: 24 }} />
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
            Crew Management
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
            New Crew Member
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

      {/* Filtros */}
      <Card sx={{ mb: 3 }} className="card-dark">
        <CardContent>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              sx={{ minWidth: 300, flex: 1 }}
            />
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Filter by Branch</InputLabel>
              <Select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                label="Filter by Branch"
              >
                <MenuItem value="">All Branches</MenuItem>
                {branches && branches.map((branch) => (
                  <MenuItem key={branch.id} value={branch.id.toString()}>
                    {branch.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Role</InputLabel>
              <Select
                value={leaderFilter}
                onChange={(e) => setLeaderFilter(e.target.value)}
                label="Role"
              >
                <MenuItem value="">All Roles</MenuItem>
                <MenuItem value="true">Leaders</MenuItem>
                <MenuItem value="false">Crew Members</MenuItem>
              </Select>
            </FormControl>
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
                      <TableCell sx={{ color: 'text.primary', fontWeight: 'bold' }}>Name</TableCell>
                      <TableCell sx={{ color: 'text.primary', fontWeight: 'bold' }}>Role</TableCell>
                      <TableCell sx={{ color: 'text.primary', fontWeight: 'bold' }}>Contact</TableCell>
                      <TableCell sx={{ color: 'text.primary', fontWeight: 'bold' }}>Telegram ID</TableCell>
                      <TableCell sx={{ color: 'text.primary', fontWeight: 'bold' }}>Animal</TableCell>
                      {/* includeStats && ( */}
                        <TableCell sx={{ color: 'text.primary', fontWeight: 'bold' }}>Branches</TableCell>
                      {/* ) */}
                      <TableCell align="center" sx={{ color: 'text.primary', fontWeight: 'bold' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {crewMembers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={/* includeStats ? 7 : 6 */ 6} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">
                            No crew members found
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      crewMembers.map((crewMember) => (
                        <TableRow key={crewMember.id} hover>
                          <TableCell>{crewMember.id}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <Avatar sx={{ mr: 2, width: 32, height: 32 }}>
                                {crewMember.name.charAt(0).toUpperCase()}
                              </Avatar>
                              <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                {crewMember.name}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip
                              icon={crewMember.is_leader ? <LeaderIcon /> : <CrewIcon />}
                              label={crewMember.is_leader ? 'Leader' : 'Crew Member'}
                              color={crewMember.is_leader ? 'warning' : 'info'}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                              {crewMember.phone && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <PhoneIcon fontSize="small" color="disabled" />
                                  <Typography variant="caption">{crewMember.phone}</Typography>
                                </Box>
                              )}
                              {!crewMember.phone && (
                                <Typography variant="caption" color="text.secondary">
                                  No phone
                                </Typography>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                             {crewMember.telegram_id ? (
                                <Chip label={crewMember.telegram_id} size="small" color="success" variant="outlined" />
                            ) : (
                                <Chip label="Not Set" size="small" />
                            )}
                          </TableCell>
                          {/* includeStats && ( */}
                            <TableCell>
                              <Typography variant="caption">{crewMember.animal || 'N/A'}</Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                icon={<BusinessIcon />}
                                label={formatNumber(crewMember.stats?.branchesCount || 0)}
                                size="small"
                                color="info"
                                variant="outlined"
                              />
                            </TableCell>
                          {/* ) */}
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                              <Tooltip title="View details">
                                <IconButton
                                  size="small"
                                  onClick={() => openViewModal(crewMember)}
                                  disabled={loading}
                                >
                                  <ViewIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Edit">
                                <IconButton
                                  size="small"
                                  onClick={() => openEditModal(crewMember)}
                                  disabled={loading}
                                >
                                  <EditIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleDelete(crewMember)}
                                  disabled={loading}
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
                count={totalCount}
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
      <Dialog open={createModalOpen} onClose={closeModals} maxWidth="md" fullWidth>
        <DialogTitle>Create New Crew Member</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={!!formErrors.name}
              helperText={formErrors.name}
              disabled={submitLoading}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                label="Phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                error={!!formErrors.phone}
                helperText={formErrors.phone}
                disabled={submitLoading}
              />
              <TextField
                fullWidth
                label="Telegram ID"
                value={formData.telegram_id}
                onChange={(e) => setFormData({ ...formData, telegram_id: e.target.value })}
                error={!!formErrors.telegram_id}
                helperText={formErrors.telegram_id}
                disabled={submitLoading}
              />
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_leader}
                  onChange={(e) => setFormData({ ...formData, is_leader: e.target.checked })}
                  disabled={submitLoading}
                />
              }
              label="Is Leader"
            />
            <TextField
              fullWidth
              label="Animal"
              placeholder="e.g., GREAT WHITE SHARK, PANTHER, TIGER..."
              value={formData.animal || ''}
              onChange={(e) => setFormData({ ...formData, animal: e.target.value })}
              disabled={submitLoading}
            />
            <Autocomplete
              multiple
              options={branches}
              getOptionLabel={(option) => option.name}
              value={branches.filter(branch => formData.branchIds?.includes(branch.id))}
              onChange={(_, selectedBranches) => {
                setFormData({
                  ...formData,
                  branchIds: selectedBranches.map(branch => branch.id)
                });
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Branches"
                  placeholder="Select branches"
                  disabled={submitLoading}
                />
              )}
            />
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
      <Dialog open={editModalOpen} onClose={closeModals} maxWidth="md" fullWidth>
        <DialogTitle>Edit Crew Member</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={!!formErrors.name}
              helperText={formErrors.name}
              disabled={submitLoading}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                label="Phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                error={!!formErrors.phone}
                helperText={formErrors.phone}
                disabled={submitLoading}
              />
              <TextField
                fullWidth
                label="Telegram ID"
                value={formData.telegram_id}
                onChange={(e) => setFormData({ ...formData, telegram_id: e.target.value })}
                error={!!formErrors.telegram_id}
                helperText={formErrors.telegram_id}
                disabled={submitLoading}
              />
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_leader}
                  onChange={(e) => setFormData({ ...formData, is_leader: e.target.checked })}
                  disabled={submitLoading}
                />
              }
              label="Is Leader"
            />
            <TextField
              fullWidth
              label="Animal"
              placeholder="e.g., GREAT WHITE SHARK, PANTHER, TIGER..."
              value={formData.animal || ''}
              onChange={(e) => setFormData({ ...formData, animal: e.target.value })}
              disabled={submitLoading}
            />
            <Autocomplete
              multiple
              options={branches}
              getOptionLabel={(option) => option.name}
              value={branches.filter(branch => formData.branchIds?.includes(branch.id))}
              onChange={(_, selectedBranches) => {
                setFormData({
                  ...formData,
                  branchIds: selectedBranches.map(branch => branch.id)
                });
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Branches"
                  placeholder="Select branches"
                  disabled={submitLoading}
                />
              )}
            />
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
      <Dialog open={viewModalOpen} onClose={closeModals} maxWidth="md" fullWidth>
        <DialogTitle>Crew Member Details</DialogTitle>
        <DialogContent>
          {selectedCrewMember && (
            <Box sx={{ pt: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  {selectedCrewMember.name}
                </Typography>
                <Chip
                  icon={selectedCrewMember.is_leader ? <LeaderIcon /> : <CrewIcon />}
                  label={selectedCrewMember.is_leader ? 'Leader' : 'Crew Member'}
                  color={selectedCrewMember.is_leader ? 'warning' : 'info'}
                  size="small"
                  sx={{ ml: 2 }}
                />
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                {selectedCrewMember.phone && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PhoneIcon />
                    <Typography>{selectedCrewMember.phone}</Typography>
                  </Box>
                )}
                {selectedCrewMember.telegram_id && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TelegramIcon />
                    <Typography>{selectedCrewMember.telegram_id}</Typography>
                  </Box>
                )}
              </Box>
              <Typography variant="subtitle1" gutterBottom>
                Branches ({selectedCrewMember.branches?.length || 0})
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {selectedCrewMember.branches?.map((branch) => (
                  <Chip key={branch.id} label={branch.name} variant="outlined" />
                )) || <Typography color="text.secondary">No branches assigned</Typography>}
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

export default CrewMembersTab; 