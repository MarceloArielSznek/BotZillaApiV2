import React, { useState, useEffect } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, 
    Button, TextField, CircularProgress, Select, MenuItem,
    FormControl, InputLabel, Checkbox, FormControlLabel
} from '@mui/material';
import { TelegramGroup } from '../../services/telegramGroupService';
import branchService, { Branch } from '../../services/branchService';
import telegramGroupCategoryService, { TelegramGroupCategory } from '../../services/telegramGroupCategoryService';

interface GroupFormModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (groupData: Omit<TelegramGroup, 'id' | 'branch'>) => Promise<void>;
    group: TelegramGroup | null;
}

const GroupFormModal: React.FC<GroupFormModalProps> = ({ open, onClose, onSave, group }) => {
    const [name, setName] = useState('');
    const [telegramId, setTelegramId] = useState('');
    const [description, setDescription] = useState('');
    const [branchId, setBranchId] = useState<string>(''); // Usar string para el Select
    const [categoryId, setCategoryId] = useState<string>(''); // Nuevo estado
    const [branches, setBranches] = useState<Branch[]>([]);
    const [categories, setCategories] = useState<TelegramGroupCategory[]>([]); // Nuevo estado
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDefault, setIsDefault] = useState(false); // Nuevo estado

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [branchesRes, categoriesRes] = await Promise.all([
                    branchService.getBranches({ limit: 1000 }),
                    telegramGroupCategoryService.getAll()
                ]);
                if (branchesRes && branchesRes.branches) setBranches(branchesRes.branches);
                if (categoriesRes) setCategories(categoriesRes);
            } catch (err) {
                console.error("Failed to fetch modal data", err);
            }
        };
        if (open) fetchData();
    }, [open]);

    useEffect(() => {
        if (group) {
            setName(group.name);
            setTelegramId(String(group.telegram_id));
            setDescription(group.description || '');
            setBranchId(group.branch_id ? String(group.branch_id) : '');
            setCategoryId(group.category_id ? String(group.category_id) : ''); // Setear categoría
            setIsDefault(group.is_default || false); // Setear is_default
        } else {
            // Reset form for creation
            setName('');
            setTelegramId('');
            setDescription('');
            setBranchId('');
            setCategoryId(''); // Resetear categoría
            setIsDefault(false); // Resetear is_default
        }
    }, [group, open]);

    const handleSubmit = async () => {
        setLoading(true);
        setError(null);
        try {
            await onSave({
                name,
                telegram_id: parseInt(telegramId, 10),
                description,
                branch_id: branchId ? parseInt(branchId, 10) : null,
                category_id: categoryId ? parseInt(categoryId, 10) : null, // Añadir categoría
                is_default: isDefault, // Añadir is_default
            });
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to save group.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>{group ? 'Edit Telegram Group' : 'Add New Telegram Group'}</DialogTitle>
            <DialogContent>
                <TextField
                    autoFocus
                    margin="dense"
                    label="Group Name"
                    type="text"
                    fullWidth
                    variant="outlined"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
                <TextField
                    margin="dense"
                    label="Telegram Group ID"
                    type="number"
                    fullWidth
                    variant="outlined"
                    value={telegramId}
                    onChange={(e) => setTelegramId(e.target.value)}
                />
                <FormControl fullWidth margin="dense">
                    <InputLabel id="branch-select-label">Branch (Optional)</InputLabel>
                    <Select
                        labelId="branch-select-label"
                        value={branchId}
                        label="Branch (Optional)"
                        onChange={(e) => setBranchId(e.target.value as string)}
                    >
                        <MenuItem value="">
                            <em>None (General Group)</em>
                        </MenuItem>
                        {branches.map((branch) => (
                            <MenuItem key={branch.id} value={String(branch.id)}>
                                {branch.name}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <FormControl fullWidth margin="dense">
                    <InputLabel id="category-select-label">Category</InputLabel>
                    <Select
                        labelId="category-select-label"
                        value={categoryId}
                        label="Category"
                        onChange={(e) => setCategoryId(e.target.value as string)}
                    >
                        {categories.map((category) => (
                            <MenuItem key={category.id} value={String(category.id)}>
                                {category.name}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <TextField
                    margin="dense"
                    label="Description"
                    type="text"
                    fullWidth
                    multiline
                    rows={3}
                    variant="outlined"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={isDefault}
                            onChange={(e) => setIsDefault(e.target.checked)}
                            name="is_default"
                        />
                    }
                    label="Set as a default group for its category and branch"
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={handleSubmit} variant="contained" disabled={loading}>
                    {loading ? <CircularProgress size={24} /> : 'Save'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default GroupFormModal;
