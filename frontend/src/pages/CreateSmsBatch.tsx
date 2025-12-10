import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  TextField,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Alert,
  CircularProgress,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Preview as PreviewIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import smsBatchService, { type CreateBatchFromFiltersParams, type CreateBatchFromSelectionParams, type SmsBatch } from '../services/smsBatchService';
import estimateService, { type Estimate, type Branch, type SalesPerson } from '../services/estimateService';
import followUpTicketService from '../services/followUpTicketService';

const CreateSmsBatch: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isEditMode = !!id;
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batch, setBatch] = useState<SmsBatch | null>(null);
  const [method, setMethod] = useState<'filters' | 'manual'>(
    searchParams.get('method') === 'manual' ? 'manual' : 'filters'
  );
  
  // Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'draft' | 'ready' | 'sent' | 'cancelled'>('draft');
  
  // Filter fields
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<number | ''>('');
  const [selectedSalesperson, setSelectedSalesperson] = useState<number | ''>('');
  const [selectedFollowUpStatus, setSelectedFollowUpStatus] = useState<number | ''>('');
  const [selectedFollowUpLabel, setSelectedFollowUpLabel] = useState<number | ''>('');
  
  // Manual selection fields
  const [selectedEstimates, setSelectedEstimates] = useState<Set<number>>(new Set());
  const [previewEstimates, setPreviewEstimates] = useState<Estimate[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  
  // Lists for dropdowns
  const [branches, setBranches] = useState<Branch[]>([]);
  const [salespeople, setSalespeople] = useState<SalesPerson[]>([]);
  const [followUpStatuses, setFollowUpStatuses] = useState<any[]>([]);
  const [followUpLabels, setFollowUpLabels] = useState<any[]>([]);

  useEffect(() => {
    loadInitialData();
    
    // Si está en modo edición, cargar el batch
    if (isEditMode && id) {
      loadBatch(parseInt(id));
    } else {
      // Si viene de selección manual, cargar los estimates seleccionados
      if (method === 'manual') {
        const savedSelection = localStorage.getItem('selectedEstimatesForBatch');
        if (savedSelection) {
          const estimateIds = JSON.parse(savedSelection);
          setSelectedEstimates(new Set(estimateIds));
          // Limpiar después de cargar
          localStorage.removeItem('selectedEstimatesForBatch');
        }
      }
    }

    // Verificar si hay estimates seleccionados para agregar al batch
    if (isEditMode && id) {
      const addToBatchId = localStorage.getItem('addToBatchId');
      const savedSelection = localStorage.getItem('selectedEstimatesForBatch');
      if (addToBatchId === id && savedSelection) {
        const estimateIds = JSON.parse(savedSelection);
        if (estimateIds.length > 0) {
          // Mostrar un mensaje o botón para agregar
        }
      }
    }
  }, [method, isEditMode, id]);

  const loadBatch = async (batchId: number) => {
    try {
      setLoading(true);
      setError(null);
      const batchData = await smsBatchService.getBatchById(batchId);
      setBatch(batchData);
      
      // Pre-llenar los campos
      setName(batchData.name);
      setDescription(batchData.description || '');
      setStatus(batchData.status || 'draft');
      
      // Si tiene metadata (filtros), cargar los filtros
      if (batchData.metadata && Object.keys(batchData.metadata).length > 0) {
        const metadata = batchData.metadata;
        setMethod('filters');
        
        if (metadata.priceMin) setPriceMin(String(metadata.priceMin));
        if (metadata.priceMax) setPriceMax(String(metadata.priceMax));
        if (metadata.startDate) setStartDate(metadata.startDate);
        if (metadata.endDate) setEndDate(metadata.endDate);
        if (metadata.branch) setSelectedBranch(metadata.branch);
        if (metadata.salesperson) setSelectedSalesperson(metadata.salesperson);
        if (metadata.followUpStatus) setSelectedFollowUpStatus(metadata.followUpStatus);
        if (metadata.followUpLabel) setSelectedFollowUpLabel(metadata.followUpLabel);
      } else if (batchData.estimates && batchData.estimates.length > 0) {
        // Si tiene estimates pero no metadata, es selección manual
        setMethod('manual');
        const estimateIds = batchData.estimates.map((e: any) => e.id);
        setSelectedEstimates(new Set(estimateIds));
      }
    } catch (err: any) {
      console.error('Error loading batch:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load batch');
    } finally {
      setLoading(false);
    }
  };

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [branchesData, salespeopleData, followUpStatusesData, followUpLabelsData] = await Promise.all([
        estimateService.getBranches().catch(() => []),
        estimateService.getSalesPersons({}).catch(() => []),
        followUpTicketService.getAllStatuses().catch(() => []),
        followUpTicketService.getAllLabels().catch(() => []),
      ]);

      setBranches(Array.isArray(branchesData) ? branchesData : []);
      setSalespeople(Array.isArray(salespeopleData) ? salespeopleData : []);
      setFollowUpStatuses(Array.isArray(followUpStatusesData) ? followUpStatusesData : []);
      setFollowUpLabels(Array.isArray(followUpLabelsData) ? followUpLabelsData : []);
    } catch (err: any) {
      console.error('Error loading initial data:', err);
      setError('Failed to load filter data');
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    try {
      setLoading(true);
      setError(null);

      if (method === 'filters') {
        // Usar el mismo endpoint de lost estimates con los filtros
        const params: any = {
          page: 1,
          limit: 1000, // Para preview, traer muchos
          priceMin: priceMin ? parseFloat(priceMin) : undefined,
          priceMax: priceMax ? parseFloat(priceMax) : undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          branch: selectedBranch || undefined,
          salesperson: selectedSalesperson || undefined,
          followUpStatus: selectedFollowUpStatus || undefined,
          followUpLabel: selectedFollowUpLabel || undefined,
        };

        const response = await estimateService.fetchLostEstimates(params);
        setPreviewEstimates(response.data);
        setPreviewOpen(true);
      } else {
        // Para selección manual, ya tenemos los estimates seleccionados
        const estimateIds = Array.from(selectedEstimates);
        if (estimateIds.length === 0) {
          setError('Please select at least one estimate');
          return;
        }
        // Aquí podrías hacer un fetch de los estimates seleccionados
        setPreviewOpen(true);
      }
    } catch (err: any) {
      console.error('Error previewing estimates:', err);
      setError(err.response?.data?.message || 'Failed to preview estimates');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Batch name is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (isEditMode && id) {
        // Modo edición: actualizar el batch
        await smsBatchService.updateBatch(parseInt(id), {
          name: name.trim(),
          description: description.trim() || undefined,
          status: status,
        });
      } else {
        // Modo creación: crear nuevo batch
        if (method === 'filters') {
          const params: CreateBatchFromFiltersParams = {
            name: name.trim(),
            description: description.trim() || undefined,
            filters: {
              priceMin: priceMin ? parseFloat(priceMin) : undefined,
              priceMax: priceMax ? parseFloat(priceMax) : undefined,
              startDate: startDate || undefined,
              endDate: endDate || undefined,
              branch: selectedBranch || undefined,
              salesperson: selectedSalesperson || undefined,
              followUpStatus: selectedFollowUpStatus || undefined,
              followUpLabel: selectedFollowUpLabel || undefined,
            },
          };

          await smsBatchService.createBatchFromFilters(params);
        } else {
          if (selectedEstimates.size === 0) {
            setError('Please select at least one estimate');
            return;
          }

          const params: CreateBatchFromSelectionParams = {
            name: name.trim(),
            description: description.trim() || undefined,
            estimateIds: Array.from(selectedEstimates),
          };

          await smsBatchService.createBatchFromSelection(params);
        }
      }

      navigate('/follow-up/sms-batches');
    } catch (err: any) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} batch:`, err);
      setError(err.response?.data?.message || `Failed to ${isEditMode ? 'update' : 'create'} batch`);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedEstimates.size === previewEstimates.length) {
      setSelectedEstimates(new Set());
    } else {
      setSelectedEstimates(new Set(previewEstimates.map(e => e.id)));
    }
  };

  const handleToggleEstimate = (estimateId: number) => {
    const newSelected = new Set(selectedEstimates);
    if (newSelected.has(estimateId)) {
      newSelected.delete(estimateId);
    } else {
      newSelected.add(estimateId);
    }
    setSelectedEstimates(newSelected);
  };

  return (
    <Box sx={{ minHeight: 'calc(100vh - 64px)', backgroundColor: 'background.default', p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/follow-up/sms-batches')}
        >
          Back
        </Button>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          {isEditMode ? 'Edit SMS Batch' : 'Create SMS Batch'}
        </Typography>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Method Selection - Solo en modo creación */}
        {!isEditMode && (
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Selection Method
              </Typography>
              <FormControl component="fieldset">
                <RadioGroup
                  value={method}
                  onChange={(e) => setMethod(e.target.value as 'filters' | 'manual')}
                  row
                >
                  <FormControlLabel value="filters" control={<Radio />} label="Filter by Conditions" />
                  <FormControlLabel value="manual" control={<Radio />} label="Manual Selection" />
                </RadioGroup>
              </FormControl>
            </CardContent>
          </Card>
        )}

        {/* Filter Mode */}
        {method === 'filters' && (
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Filters
              </Typography>
              {isEditMode && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Note: You can only edit the batch name and description. To change filters or estimates, create a new batch.
                </Alert>
              )}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <TextField
                    label="Min Price"
                    type="number"
                    value={priceMin}
                    onChange={(e) => setPriceMin(e.target.value)}
                    size="small"
                    sx={{ flex: '1 1 150px' }}
                    disabled={isEditMode}
                  />
                  <TextField
                    label="Max Price"
                    type="number"
                    value={priceMax}
                    onChange={(e) => setPriceMax(e.target.value)}
                    size="small"
                    sx={{ flex: '1 1 150px' }}
                    disabled={isEditMode}
                  />
                  <TextField
                    label="Start Date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    size="small"
                    sx={{ flex: '1 1 150px' }}
                    disabled={isEditMode}
                  />
                  <TextField
                    label="End Date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    size="small"
                    sx={{ flex: '1 1 150px' }}
                    disabled={isEditMode}
                  />
                </Box>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <FormControl size="small" sx={{ flex: '1 1 200px' }}>
                    <InputLabel>Branch</InputLabel>
                    <Select
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value as number | '')}
                      label="Branch"
                      disabled={isEditMode}
                    >
                      <MenuItem value="">All Branches</MenuItem>
                      {branches.map((branch) => (
                        <MenuItem key={branch.id} value={branch.id}>
                          {branch.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ flex: '1 1 200px' }}>
                    <InputLabel>Salesperson</InputLabel>
                    <Select
                      value={selectedSalesperson}
                      onChange={(e) => setSelectedSalesperson(e.target.value as number | '')}
                      label="Salesperson"
                      disabled={isEditMode}
                    >
                      <MenuItem value="">All Salespersons</MenuItem>
                      {salespeople.map((person) => (
                        <MenuItem key={person.id} value={person.id}>
                          {person.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ flex: '1 1 200px' }}>
                    <InputLabel>Follow-Up Status</InputLabel>
                    <Select
                      value={selectedFollowUpStatus}
                      onChange={(e) => setSelectedFollowUpStatus(e.target.value as number | '')}
                      label="Follow-Up Status"
                      disabled={isEditMode}
                    >
                      <MenuItem value="">All Statuses</MenuItem>
                      {followUpStatuses.map((status) => (
                        <MenuItem key={status.id} value={status.id}>
                          {status.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ flex: '1 1 200px' }}>
                    <InputLabel>Follow-Up Label</InputLabel>
                    <Select
                      value={selectedFollowUpLabel}
                      onChange={(e) => setSelectedFollowUpLabel(e.target.value as number | '')}
                      label="Follow-Up Label"
                      disabled={isEditMode}
                    >
                      <MenuItem value="">All Labels</MenuItem>
                      {followUpLabels.map((label) => (
                        <MenuItem key={label.id} value={label.id}>
                          {label.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                {!isEditMode && (
                  <Button
                    variant="outlined"
                    startIcon={<PreviewIcon />}
                    onClick={handlePreview}
                    disabled={loading}
                  >
                    Preview Estimates
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Add Estimates Section - Solo en modo edición */}
        {isEditMode && batch && (
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Add Estimates to Batch
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                Current batch contains {batch.total_estimates || 0} estimate(s). You can add more estimates by selecting them from the Lost Estimates page.
              </Alert>
              {(() => {
                const addToBatchId = localStorage.getItem('addToBatchId');
                const savedSelection = localStorage.getItem('selectedEstimatesForBatch');
                const hasSelection = addToBatchId === String(batch.id) && savedSelection;
                const estimateIds = hasSelection ? JSON.parse(savedSelection) : [];
                
                return (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {hasSelection && estimateIds.length > 0 && (
                      <Alert severity="success" sx={{ mb: 1 }}>
                        {estimateIds.length} estimate(s) selected and ready to add
                      </Alert>
                    )}
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Button
                        variant="outlined"
                        onClick={() => {
                          // Guardar el batch ID en localStorage para que la página de estimates pueda usarlo
                          localStorage.setItem('addToBatchId', String(batch.id));
                          navigate('/follow-up/estimates');
                        }}
                      >
                        Go to Lost Estimates to Add
                      </Button>
                      {hasSelection && estimateIds.length > 0 && (
                        <Button
                          variant="contained"
                          color="success"
                          onClick={async () => {
                            try {
                              setSaving(true);
                              setError(null);
                              await smsBatchService.addEstimatesToBatch(batch.id, estimateIds);
                              localStorage.removeItem('selectedEstimatesForBatch');
                              localStorage.removeItem('addToBatchId');
                              // Recargar el batch
                              await loadBatch(batch.id);
                            } catch (err: any) {
                              console.error('Error adding estimates:', err);
                              setError(err.response?.data?.message || 'Failed to add estimates');
                            } finally {
                              setSaving(false);
                            }
                          }}
                          disabled={saving}
                        >
                          {saving ? 'Adding...' : `Add ${estimateIds.length} Estimate(s)`}
                        </Button>
                      )}
                    </Box>
                  </Box>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* Manual Selection Mode */}
        {method === 'manual' && !isEditMode && (
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Manual Selection
              </Typography>
              {selectedEstimates.size > 0 ? (
                <>
                  <Alert severity="success" sx={{ mb: 2 }}>
                    {selectedEstimates.size} estimate(s) selected
                  </Alert>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      // Cargar los estimates seleccionados para preview
                      const estimateIds = Array.from(selectedEstimates);
                      // Aquí podrías hacer un fetch de los estimates
                      setPreviewOpen(true);
                    }}
                  >
                    Preview Selected Estimates
                  </Button>
                </>
              ) : (
                <>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Go to the Lost Estimates page to select estimates, then return here to create the batch.
                  </Alert>
                  <Button
                    variant="outlined"
                    onClick={() => navigate('/follow-up/estimates')}
                  >
                    Go to Lost Estimates
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Batch Details */}
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Batch Details
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Batch Name *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
                required
                placeholder="e.g., Orange County - Dec 2025"
              />
              <TextField
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                fullWidth
                multiline
                rows={3}
                placeholder="Optional description..."
              />
              {isEditMode && (
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'draft' | 'ready' | 'sent' | 'cancelled')}
                    label="Status"
                  >
                    <MenuItem value="draft">Draft</MenuItem>
                    <MenuItem value="ready">Ready</MenuItem>
                    <MenuItem value="sent">Sent</MenuItem>
                    <MenuItem value="cancelled">Cancelled</MenuItem>
                  </Select>
                </FormControl>
              )}
            </Box>
          </CardContent>
        </Card>

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            onClick={() => navigate('/follow-up/sms-batches')}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || !name.trim()}
          >
            {saving 
              ? (isEditMode ? 'Updating...' : 'Creating...') 
              : (isEditMode ? 'Update Batch' : 'Create Batch')}
          </Button>
        </Box>
      </Box>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          Preview Estimates ({previewEstimates.length} found)
        </DialogTitle>
        <DialogContent>
          <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  {method === 'manual' && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedEstimates.size === previewEstimates.length && previewEstimates.length > 0}
                        indeterminate={selectedEstimates.size > 0 && selectedEstimates.size < previewEstimates.length}
                        onChange={handleSelectAll}
                      />
                    </TableCell>
                  )}
                  <TableCell>Name</TableCell>
                  <TableCell>Branch</TableCell>
                  <TableCell>Salesperson</TableCell>
                  <TableCell>Final Price</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {previewEstimates.map((estimate) => (
                  <TableRow key={estimate.id} hover>
                    {method === 'manual' && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedEstimates.has(estimate.id)}
                          onChange={() => handleToggleEstimate(estimate.id)}
                        />
                      </TableCell>
                    )}
                    <TableCell>{estimate.name}</TableCell>
                    <TableCell>{estimate.Branch?.name || 'N/A'}</TableCell>
                    <TableCell>{estimate.SalesPerson?.name || 'N/A'}</TableCell>
                    <TableCell>
                      {estimate.final_price
                        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(estimate.final_price))
                        : 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Close</Button>
          {method === 'manual' && (
            <Button
              variant="contained"
              onClick={() => {
                setPreviewOpen(false);
                // Los estimates seleccionados ya están en selectedEstimates
              }}
            >
              Confirm Selection ({selectedEstimates.size})
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CreateSmsBatch;

