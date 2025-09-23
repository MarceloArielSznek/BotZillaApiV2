import React, { useState, useEffect } from 'react';
import { 
    Box, Typography, Paper, Button, CircularProgress, Alert,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton,
    Snackbar
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import telegramGroupService, { TelegramGroup } from '../services/telegramGroupService';
import { PagedResponse } from '../interfaces/PagedResponse';
import GroupFormModal from '../components/settings/GroupFormModal';

const TelegramGroups = () => {
    const [groups, setGroups] = useState<TelegramGroup[]>([]);
    const [pagination, setPagination] = useState<PagedResponse<TelegramGroup>['pagination'] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<TelegramGroup | null>(null);
    
    const [notification, setNotification] = useState('');

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async (page = 1) => {
        setLoading(true);
        setError(null);
        try {
            const response = await telegramGroupService.getAll(page);
            // Añadir comprobación para evitar errores por peticiones canceladas
            if (response && response.data) {
                setGroups(response.data);
                setPagination(response.pagination);
            }
        } catch (err) {
            setError('Failed to fetch Telegram groups.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (group: TelegramGroup | null = null) => {
        setEditingGroup(group);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingGroup(null);
    };

    const handleSave = async (groupData: Omit<TelegramGroup, 'id' | 'branch'>) => {
        try {
            if (editingGroup) {
                await telegramGroupService.update(editingGroup.id, groupData);
                setNotification('Group updated successfully!');
            } else {
                await telegramGroupService.create(groupData);
                setNotification('Group created successfully!');
            }
            fetchGroups(pagination?.currentPage || 1);
        } catch (err: any) {
            console.error('Save operation failed:', err);
            // Propagar el error para que el modal pueda mostrarlo
            throw new Error(err.response?.data?.message || 'Failed to save group.');
        }
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('Are you sure you want to delete this group?')) {
            try {
                await telegramGroupService.delete(id);
                setNotification('Group deleted successfully!');
                fetchGroups(pagination?.currentPage || 1);
            } catch (err) {
                setError('Failed to delete group.');
                console.error(err);
            }
        }
    };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
            Telegram Groups Management
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
            Create, edit, and manage Telegram groups for employee onboarding.
            </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenModal()}>
            Add Group
        </Button>
      </Box>

      {/* Content */}
      <Paper sx={{ p: 0, borderRadius: 2, overflow: 'hidden' }}>
        {loading && <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>}
        {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}
        {!loading && !error && (
            <TableContainer>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Telegram ID</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Branch</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Category</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {groups.map((group) => (
                            <TableRow key={group.id} hover>
                                <TableCell>{group.name}</TableCell>
                                <TableCell><code>{group.telegram_id}</code></TableCell>
                                <TableCell>{group.branch?.name || 'N/A'}</TableCell>
                                <TableCell>{group.category?.name || 'N/A'}</TableCell>
                                <TableCell align="right">
                                    <IconButton size="small" onClick={() => handleOpenModal(group)}><EditIcon /></IconButton>
                                    <IconButton size="small" onClick={() => handleDelete(group.id)}><DeleteIcon /></IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        )}
      </Paper>
      
      <GroupFormModal 
        open={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSave}
        group={editingGroup}
      />

      <Snackbar
        open={!!notification}
        autoHideDuration={6000}
        onClose={() => setNotification('')}
        message={notification}
      />
    </Box>
  );
};

export default TelegramGroups;
