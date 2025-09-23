import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Paper, Button, CircularProgress, Alert,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton,
    Snackbar, TextField, InputAdornment, TableSortLabel, Grid, Select, MenuItem, FormControl, InputLabel, TablePagination
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Search as SearchIcon } from '@mui/icons-material';
import telegramGroupService, { TelegramGroup, GetGroupsParams } from '../services/telegramGroupService';
import branchService, { Branch } from '../services/branchService';
import telegramGroupCategoryService, { TelegramGroupCategory } from '../services/telegramGroupCategoryService';
import { PagedResponse } from '../interfaces/PagedResponse';
import GroupFormModal from '../components/settings/GroupFormModal';
import { useDebounce } from '../hooks/useDebounce';

type Order = 'ASC' | 'DESC';
type HeadCell = {
    id: keyof TelegramGroup | 'branch' | 'category';
    label: string;
    sortable: boolean;
};

const headCells: readonly HeadCell[] = [
    { id: 'name', label: 'Name', sortable: true },
    { id: 'telegram_id', label: 'Telegram ID', sortable: true },
    { id: 'branch', label: 'Branch', sortable: true },
    { id: 'category', label: 'Category', sortable: true },
    { id: 'id', label: 'Actions', sortable: false },
];


const TelegramGroups = () => {
    const [groups, setGroups] = useState<TelegramGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // --- Estados de paginación ---
    const [page, setPage] = useState(0); // 0-indexed for MUI component
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalItems, setTotalItems] = useState(0);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<TelegramGroup | null>(null);

    const [notification, setNotification] = useState('');

    // --- Estados para filtro y ordenación ---
    const [nameFilter, setNameFilter] = useState('');
    const [branchFilter, setBranchFilter] = useState<number | ''>('');
    const [categoryFilter, setCategoryFilter] = useState<number | ''>('');
    const [order, setOrder] = useState<Order>('ASC');
    const [orderBy, setOrderBy] = useState<HeadCell['id']>('name');

    // Listas para poblar los selects de filtros
    const [branches, setBranches] = useState<Branch[]>([]);
    const [categories, setCategories] = useState<TelegramGroupCategory[]>([]);
    const [filtersLoading, setFiltersLoading] = useState(true);

    const debouncedNameFilter = useDebounce(nameFilter, 500);

    // Este useCallback ahora solo define la función, pero no se pasa como dependencia directa al useEffect principal.
    const fetchGroups = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params: GetGroupsParams = {
                page: page + 1,
                limit: rowsPerPage,
                sortBy: orderBy,
                order,
                name: debouncedNameFilter,
                branchId: branchFilter,
                categoryId: categoryFilter,
            };
            const response = await telegramGroupService.getAll(params);
            if (response && response.data) {
                setGroups(response.data);
                setTotalItems(response.pagination.totalItems);
            }
        } catch (err) {
            setError('Failed to fetch Telegram groups.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, orderBy, order, debouncedNameFilter, branchFilter, categoryFilter]); // Dependencias correctas

    // Effect para cargar los datos de los filtros (branches y categories) una sola vez
    useEffect(() => {
        const fetchFilterData = async () => {
            try {
                const [branchesRes, categoriesRes] = await Promise.all([
                    branchService.getBranches({ limit: 1000 }),
                    telegramGroupCategoryService.getAll()
                ]);
                if (branchesRes && branchesRes.branches) setBranches(branchesRes.branches);
                if (categoriesRes) setCategories(categoriesRes);
            } catch (err) {
                console.error("Failed to fetch filter data", err);
                setError("Could not load filter options. Some functionalities may be limited.");
            } finally {
                setFiltersLoading(false);
            }
        };
        fetchFilterData();
    }, []);

    useEffect(() => {
        // No ejecutar la búsqueda hasta que los filtros estén listos
        if (filtersLoading) return;

        fetchGroups();
        
    // Las dependencias aquí son las que realmente disparan la recarga de datos.
    }, [filtersLoading, page, rowsPerPage, orderBy, order, debouncedNameFilter, branchFilter, categoryFilter, fetchGroups]);


    const handleRequestSort = (property: HeadCell['id']) => {
        const isAsc = orderBy === property && order === 'ASC';
        setOrder(isAsc ? 'DESC' : 'ASC');
        setOrderBy(property);
    };

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    };
    
    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0); // Volver a la primera página
    };
    
    const handleOpenModal = (group: TelegramGroup | null = null) => {
        setEditingGroup(group);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingGroup(null);
    };

    const handleSave = async (groupData: Omit<TelegramGroup, 'id' | 'branch' | 'category'>) => {
        try {
            if (editingGroup) {
                await telegramGroupService.update(editingGroup.id, groupData);
                setNotification('Group updated successfully!');
            } else {
                await telegramGroupService.create(groupData);
                setNotification('Group created successfully!');
            }
            fetchGroups();
        } catch (err: any) {
            console.error('Save operation failed:', err);
            throw new Error(err.response?.data?.message || 'Failed to save group.');
        }
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('Are you sure you want to delete this group?')) {
            try {
                await telegramGroupService.delete(id);
                setNotification('Group deleted successfully!');
                fetchGroups();
            } catch (err) {
                setError('Failed to delete group.');
                console.error(err);
            }
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
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

            <Paper sx={{ p: 2, mb: 2 }}>
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                        <TextField
                            fullWidth
                            variant="outlined"
                            placeholder="Search by name..."
                            value={nameFilter}
                            onChange={(e) => setNameFilter(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon />
                                    </InputAdornment>
                                ),
                            }}
                        />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <FormControl fullWidth sx={{ minWidth: 180 }}>
                            <InputLabel id="branch-filter-label">Branch</InputLabel>
                            <Select
                                labelId="branch-filter-label"
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
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <FormControl fullWidth sx={{ minWidth: 180 }}>
                            <InputLabel id="category-filter-label">Category</InputLabel>
                            <Select
                                labelId="category-filter-label"
                                value={categoryFilter}
                                label="Category"
                                onChange={(e) => setCategoryFilter(e.target.value as number | '')}
                            >
                                <MenuItem value="">
                                    <em>All Categories</em>
                                </MenuItem>
                                {categories.map((category) => (
                                    <MenuItem key={category.id} value={category.id}>
                                        {category.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                </Grid>
            </Paper>

            <Paper sx={{ p: 0, borderRadius: 2, overflow: 'hidden' }}>
                {loading && <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>}
                {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}
                {!loading && !error && (
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    {headCells.map((headCell) => (
                                        <TableCell
                                            key={headCell.id}
                                            sortDirection={orderBy === headCell.id ? order.toLowerCase() as 'asc' | 'desc' : false}
                                            sx={{ fontWeight: 'bold' }}
                                        >
                                            {headCell.sortable ? (
                                                <TableSortLabel
                                                    active={orderBy === headCell.id}
                                                    direction={orderBy === headCell.id ? order.toLowerCase() as 'asc' | 'desc' : 'asc'}
                                                    onClick={() => handleRequestSort(headCell.id)}
                                                >
                                                    {headCell.label}
                                                </TableSortLabel>
                                            ) : (
                                                headCell.label
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {groups.map((group) => (
                                    <TableRow key={group.id} hover>
                                        <TableCell>{group.name}</TableCell>
                                        <TableCell><code>{group.telegram_id}</code></TableCell>
                                        <TableCell>{group.branch?.name || 'N/A'}</TableCell>
                                        <TableCell>{group.category?.name || 'N/A'}</TableCell>
                                        <TableCell>
                                            <IconButton size="small" onClick={() => handleOpenModal(group)}><EditIcon /></IconButton>
                                            <IconButton size="small" onClick={() => handleDelete(group.id)}><DeleteIcon /></IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
                <TablePagination
                    rowsPerPageOptions={[5, 10, 25]}
                    component="div"
                    count={totalItems}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                />
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
