import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Tabs,
  Tab,
  Chip,
  CircularProgress
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Sync as SyncIcon,
  Add as AddIcon
} from '@mui/icons-material';
import columnMapService, { 
  type GroupedColumnMaps, 
  type ColumnMapping, 
  type UpdateColumnMappingData 
} from '../../services/columnMapService';

// Función para convertir índice numérico a letra de columna (0=A, 1=B, etc.)
const indexToLetter = (index: number): string => {
  let result = '';
  while (index >= 0) {
    result = String.fromCharCode(65 + (index % 26)) + result;
    index = Math.floor(index / 26) - 1;
  }
  return result;
};

const ColumnMapManager: React.FC = () => {
  const [columnMaps, setColumnMaps] = useState<GroupedColumnMaps>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<UpdateColumnMappingData>({});
  
  // Estado para tabs
  const [currentTab, setCurrentTab] = useState(0);
  
  // Estados para sync modal
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncSheetName, setSyncSheetName] = useState('');
  const [syncHeaderRow, setSyncHeaderRow] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);

  // Estados para delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sheetToDelete, setSheetToDelete] = useState<string>('');

  useEffect(() => {
    loadColumnMaps();
  }, []);

  const loadColumnMaps = async () => {
    try {
      setLoading(true);
      setError(null);
      const maps = await columnMapService.getAllColumnMaps();
      setColumnMaps(maps);
    } catch (err: any) {
      setError('Error loading column maps: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (mapping: ColumnMapping) => {
    setEditingId(mapping.id);
    setEditFormData({
      field_name: mapping.field_name,
      type: mapping.type,
      header_name: mapping.header_name || ''
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditFormData({});
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    
    try {
      await columnMapService.updateColumnMapping(editingId, editFormData);
      await loadColumnMaps();
      setEditingId(null);
      setEditFormData({});
    } catch (err: any) {
      setError('Error updating column mapping: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDeleteSheet = async () => {
    if (!sheetToDelete) return;
    
    try {
      await columnMapService.deleteColumnMapBySheet(sheetToDelete);
      await loadColumnMaps();
      setDeleteDialogOpen(false);
      setSheetToDelete('');
    } catch (err: any) {
      setError('Error deleting column mappings: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleSyncColumnMap = async () => {
    if (!syncSheetName.trim() || !syncHeaderRow.trim()) {
      setError('Sheet name and header row are required');
      return;
    }

    try {
      setSyncLoading(true);
      const headerArray = syncHeaderRow.split(',').map(h => h.trim());
      await columnMapService.syncColumnMap(syncSheetName.trim(), headerArray, false);
      await loadColumnMaps();
      setSyncModalOpen(false);
      setSyncSheetName('');
      setSyncHeaderRow('');
    } catch (err: any) {
      setError('Error syncing column map: ' + (err.response?.data?.message || err.message));
    } finally {
      setSyncLoading(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'crew_member': return 'primary';
      case 'field': return 'secondary';
      default: return 'default';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'crew_member': return 'Crew Member';
      case 'field': return 'Field';
      default: return type;
    }
  };

  // Obtener las sheets como array para las tabs
  const sheetNames = Object.keys(columnMaps);
  const currentSheetName = sheetNames[currentTab] || '';
  const currentColumns = columnMaps[currentSheetName] || [];

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">
          Column Map Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<SyncIcon />}
          onClick={() => setSyncModalOpen(true)}
        >
          Sync New Headers
        </Button>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Column Maps by Sheet */}
      {sheetNames.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Column Maps Found
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Use the "Sync New Headers" button to create column mappings from spreadsheet headers.
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setSyncModalOpen(true)}
          >
            Sync Headers
          </Button>
        </Paper>
      ) : (
        <Paper sx={{ width: '100%' }}>
          {/* Tabs para cada sheet */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, pt: 2 }}>
            <Tabs
              value={currentTab}
              onChange={(_, newValue) => setCurrentTab(newValue)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ flexGrow: 1 }}
            >
              {sheetNames.map((sheetName, index) => (
                <Tab
                  key={sheetName}
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {sheetName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {columnMaps[sheetName].length} columns
                      </Typography>
                    </Box>
                  }
                />
              ))}
            </Tabs>
            
            {/* Botón de eliminar sheet actual */}
            {currentSheetName && (
              <IconButton
                onClick={() => {
                  setSheetToDelete(currentSheetName);
                  setDeleteDialogOpen(true);
                }}
                color="error"
                size="small"
                sx={{ ml: 2 }}
              >
                <DeleteIcon />
              </IconButton>
            )}
          </Box>

          {/* Contenido de la tab actual */}
          <Box sx={{ p: 3 }}>
            {currentColumns.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Column</strong></TableCell>
                      <TableCell><strong>Field Name</strong></TableCell>
                      <TableCell><strong>Type</strong></TableCell>
                      <TableCell><strong>Header Name</strong></TableCell>
                      <TableCell align="center"><strong>Actions</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {currentColumns
                      .sort((a, b) => a.column_index - b.column_index)
                      .map((mapping) => (
                      <TableRow key={mapping.id} hover>
                        <TableCell>
                          <Chip 
                            label={indexToLetter(mapping.column_index)} 
                            variant="outlined" 
                            size="small"
                            color="primary"
                          />
                        </TableCell>
                        <TableCell>
                          {editingId === mapping.id ? (
                            <TextField
                              size="small"
                              value={editFormData.field_name || ''}
                              onChange={(e) => setEditFormData(prev => ({
                                ...prev,
                                field_name: e.target.value
                              }))}
                              fullWidth
                            />
                          ) : (
                            mapping.field_name
                          )}
                        </TableCell>
                        <TableCell>
                          {editingId === mapping.id ? (
                            <FormControl size="small" fullWidth>
                              <Select
                                value={editFormData.type || ''}
                                onChange={(e) => setEditFormData(prev => ({
                                  ...prev,
                                  type: e.target.value as 'field' | 'crew_member'
                                }))}
                              >
                                <MenuItem value="field">Field</MenuItem>
                                <MenuItem value="crew_member">Crew Member</MenuItem>
                              </Select>
                            </FormControl>
                          ) : (
                            <Chip
                              label={getTypeLabel(mapping.type)}
                              color={getTypeColor(mapping.type) as any}
                              size="small"
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          {editingId === mapping.id ? (
                            <TextField
                              size="small"
                              value={editFormData.header_name || ''}
                              onChange={(e) => setEditFormData(prev => ({
                                ...prev,
                                header_name: e.target.value
                              }))}
                              fullWidth
                              placeholder="Optional header name"
                            />
                          ) : (
                            mapping.header_name || '-'
                          )}
                        </TableCell>
                        <TableCell align="center">
                          {editingId === mapping.id ? (
                            <Box>
                              <Tooltip title="Save">
                                <IconButton
                                  onClick={handleSaveEdit}
                                  color="primary"
                                  size="small"
                                >
                                  <SaveIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Cancel">
                                <IconButton
                                  onClick={handleCancelEdit}
                                  size="small"
                                >
                                  <CancelIcon />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          ) : (
                            <Tooltip title="Edit">
                              <IconButton
                                onClick={() => handleEdit(mapping)}
                                size="small"
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box textAlign="center" py={4}>
                <Typography variant="body1" color="text.secondary">
                  No columns mapped for {currentSheetName}
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>
      )}

      {/* Sync Modal */}
      <Dialog open={syncModalOpen} onClose={() => setSyncModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Sync Column Headers</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Sheet Name"
              value={syncSheetName}
              onChange={(e) => setSyncSheetName(e.target.value)}
              fullWidth
              placeholder="e.g., San Bernardino"
              helperText="Enter the name of the spreadsheet/branch"
            />
            <TextField
              label="Header Row (CSV)"
              value={syncHeaderRow}
              onChange={(e) => setSyncHeaderRow(e.target.value)}
              fullWidth
              multiline
              rows={3}
              placeholder="Job Name,Crew Lead,John Doe,Jane Smith,Techs hours,Unbillable Job Hours"
              helperText="Enter the header row as comma-separated values"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSyncModalOpen(false)} disabled={syncLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleSyncColumnMap}
            variant="contained"
            disabled={syncLoading || !syncSheetName.trim() || !syncHeaderRow.trim()}
            startIcon={syncLoading ? <CircularProgress size={20} /> : <SyncIcon />}
          >
            {syncLoading ? 'Syncing...' : 'Sync Headers'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete all column mappings for "{sheetToDelete}"?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteSheet}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ColumnMapManager;
