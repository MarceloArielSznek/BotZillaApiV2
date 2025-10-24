import React, { useState, useEffect } from 'react';
import {
    Box, Tabs, Tab, Typography, Button, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Paper, Dialog, DialogActions,
    DialogContent, DialogTitle, TextField, CircularProgress, Alert, IconButton, Tooltip,
    Select, MenuItem, FormControl, InputLabel
} from '@mui/material';
import {
    ListAlt as TemplatesIcon,
    Class as TypesIcon,
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Refresh as RefreshIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';

import notificationTypeService, { type NotificationType } from '../../services/notificationTypeService';
import notificationTemplateService, { type NotificationTemplate, type CreateTemplateData } from '../../services/notificationTemplateService';

// ----------------- Templates Management Component -----------------

const TemplatesManagement = () => {
    const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
    const [types, setTypes] = useState<NotificationType[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentTemplate, setCurrentTemplate] = useState<NotificationTemplate | null>(null);
    const [formData, setFormData] = useState<CreateTemplateData>({ name: '', notification_type_id: 0, level: null, template_text: '' });
    const { enqueueSnackbar } = useSnackbar();

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [templatesData, typesData] = await Promise.all([
                notificationTemplateService.getAll(),
                notificationTypeService.getAll()
            ]);
            // Validación defensiva de las respuestas
            if (templatesData && Array.isArray(templatesData)) {
                setTemplates(templatesData);
            } else {
                console.warn('Invalid response from getAll notification templates:', templatesData);
                setTemplates([]);
            }
            
            if (typesData && Array.isArray(typesData)) {
                setTypes(typesData);
            } else {
                console.warn('Invalid response from getAll notification types:', typesData);
                setTypes([]);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch data');
            enqueueSnackbar('Failed to load data', { variant: 'error' });
            setTemplates([]); // Asegurar que sean arrays vacíos en caso de error
            setTypes([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);
    
    const handleOpenModal = (template: NotificationTemplate | null = null) => {
        if (template) {
            setIsEditing(true);
            setCurrentTemplate(template);
            setFormData({
                name: template.name,
                notification_type_id: template.notification_type_id,
                level: template.level,
                template_text: template.template_text,
            });
        } else {
            setIsEditing(false);
            setCurrentTemplate(null);
            setFormData({ name: '', notification_type_id: types[0]?.id || 0, level: null, template_text: '' });
        }
        setModalOpen(true);
    };

    const handleCloseModal = () => setModalOpen(false);

    const handleDelete = async (id: number) => {
        if (window.confirm('Are you sure you want to delete this template?')) {
            try {
                await notificationTemplateService.delete(id);
                enqueueSnackbar('Template deleted successfully', { variant: 'success' });
                fetchData();
            } catch (err: any) {
                enqueueSnackbar(err.response?.data?.message || 'Failed to delete template', { variant: 'error' });
            }
        }
    };

    const handleSubmit = async () => {
        try {
            if (isEditing && currentTemplate) {
                await notificationTemplateService.update(currentTemplate.id, formData);
                enqueueSnackbar('Template updated successfully', { variant: 'success' });
            } else {
                await notificationTemplateService.create(formData);
                enqueueSnackbar('Template created successfully', { variant: 'success' });
            }
            fetchData();
            handleCloseModal();
        } catch (err: any) {
            enqueueSnackbar(err.response?.data?.message || 'Failed to save template', { variant: 'error' });
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Manage Notification Templates</Typography>
                <div>
                    <Tooltip title="Refresh Data"><IconButton onClick={fetchData}><RefreshIcon /></IconButton></Tooltip>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenModal()}>New Template</Button>
                </div>
            </Box>

            {loading && <CircularProgress />}
            {error && <Alert severity="error">{error}</Alert>}

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Level</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {templates.map((template) => (
                            <TableRow key={template.id}>
                                <TableCell>{template.name}</TableCell>
                                <TableCell>{template.notificationType?.name}</TableCell>
                                <TableCell>{template.level ?? 'N/A'}</TableCell>
                                <TableCell align="right">
                                    <IconButton onClick={() => handleOpenModal(template)}><EditIcon /></IconButton>
                                    <IconButton onClick={() => handleDelete(template.id)}><DeleteIcon /></IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={modalOpen} onClose={handleCloseModal} fullWidth maxWidth="sm">
                <DialogTitle>{isEditing ? 'Edit' : 'Create'} Notification Template</DialogTitle>
                <DialogContent>
                    <TextField autoFocus margin="dense" label="Template Name" type="text" fullWidth variant="outlined" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} sx={{ mb: 2 }}/>
                    <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>Type</InputLabel>
                        <Select label="Type" value={formData.notification_type_id} onChange={(e) => setFormData({ ...formData, notification_type_id: e.target.value as number })}>
                            {types.map(type => <MenuItem key={type.id} value={type.id}>{type.name}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <TextField margin="dense" label="Level (optional)" type="number" fullWidth variant="outlined" value={formData.level ?? ''} onChange={(e) => setFormData({ ...formData, level: e.target.value ? Number(e.target.value) : null })} sx={{ mb: 2 }}/>
                    <TextField margin="dense" label="Template Text" multiline rows={4} fullWidth variant="outlined" value={formData.template_text} onChange={(e) => setFormData({ ...formData, template_text: e.target.value })}/>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseModal}>Cancel</Button>
                    <Button onClick={handleSubmit}>{isEditing ? 'Save' : 'Create'}</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

// ----------------- Types Management Component -----------------

const TypesManagement = () => {
    const [types, setTypes] = useState<NotificationType[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentType, setCurrentType] = useState<NotificationType | null>(null);
    const [typeName, setTypeName] = useState('');
    const { enqueueSnackbar } = useSnackbar();

    const fetchTypes = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await notificationTypeService.getAll();
            // Validación defensiva de la respuesta
            if (data && Array.isArray(data)) {
                setTypes(data);
            } else {
                console.warn('Invalid response from getAll notification types:', data);
                setTypes([]);
                setError('Invalid response format from server');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch notification types');
            enqueueSnackbar('Failed to load types', { variant: 'error' });
            setTypes([]); // Asegurar que types sea un array vacío en caso de error
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTypes();
    }, []);

    const handleOpenModal = (type: NotificationType | null = null) => {
        if (type) {
            setIsEditing(true);
            setCurrentType(type);
            setTypeName(type.name);
        } else {
            setIsEditing(false);
            setCurrentType(null);
            setTypeName('');
        }
        setModalOpen(true);
    };

    const handleCloseModal = () => {
        setModalOpen(false);
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('Are you sure you want to delete this type? This might affect existing templates.')) {
            try {
                await notificationTypeService.delete(id);
                enqueueSnackbar('Type deleted successfully', { variant: 'success' });
                fetchTypes();
            } catch (err: any) {
                enqueueSnackbar(err.response?.data?.message || 'Failed to delete type', { variant: 'error' });
            }
        }
    };

    const handleSubmit = async () => {
        try {
            if (isEditing && currentType) {
                await notificationTypeService.update(currentType.id, typeName);
                enqueueSnackbar('Type updated successfully', { variant: 'success' });
            } else {
                await notificationTypeService.create(typeName);
                enqueueSnackbar('Type created successfully', { variant: 'success' });
            }
            fetchTypes();
            handleCloseModal();
        } catch (err: any) {
            enqueueSnackbar(err.response?.data?.message || 'Failed to save type', { variant: 'error' });
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Manage Notification Types</Typography>
                <div>
                    <Tooltip title="Refresh Data">
                        <IconButton onClick={fetchTypes}><RefreshIcon /></IconButton>
                    </Tooltip>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenModal()}>
                        New Type
                    </Button>
                </div>
            </Box>

            {loading && <CircularProgress />}
            {error && <Alert severity="error">{error}</Alert>}

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>ID</TableCell>
                            <TableCell>Name</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {types.map((type) => (
                            <TableRow key={type.id}>
                                <TableCell>{type.id}</TableCell>
                                <TableCell>{type.name}</TableCell>
                                <TableCell align="right">
                                    <IconButton onClick={() => handleOpenModal(type)}><EditIcon /></IconButton>
                                    <IconButton onClick={() => handleDelete(type.id)}><DeleteIcon /></IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={modalOpen} onClose={handleCloseModal}>
                <DialogTitle>{isEditing ? 'Edit' : 'Create'} Notification Type</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Type Name"
                        type="text"
                        fullWidth
                        variant="standard"
                        value={typeName}
                        onChange={(e) => setTypeName(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseModal}>Cancel</Button>
                    <Button onClick={handleSubmit}>{isEditing ? 'Save' : 'Create'}</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

// ----------------- Main Tab Component -----------------

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`notifications-settings-tabpanel-${index}`}
            aria-labelledby={`notifications-settings-tab-${index}`}
            {...other}
        >
            {value === index && <Box>{children}</Box>}
        </div>
    );
}

const NotificationsTab = () => {
    const [value, setValue] = useState(0);

    const handleChange = (event: React.SyntheticEvent, newValue: number) => {
        setValue(newValue);
    };

    const tabs = [
        {
            label: 'Templates',
            icon: <TemplatesIcon />,
            component: <TemplatesManagement />
        },
        {
            label: 'Types',
            icon: <TypesIcon />,
            component: <TypesManagement />
        }
    ];

    return (
        <Box sx={{ width: '100%' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={value} onChange={handleChange} aria-label="notification settings tabs">
                    {tabs.map((tab, index) => (
                        <Tab
                            key={index}
                            label={tab.label}
                            icon={tab.icon}
                            iconPosition="start"
                        />
                    ))}
                </Tabs>
            </Box>
            {tabs.map((tab, index) => (
                <TabPanel key={index} value={value} index={index}>
                    {tab.component}
                </TabPanel>
            ))}
        </Box>
    );
};

export default NotificationsTab; 