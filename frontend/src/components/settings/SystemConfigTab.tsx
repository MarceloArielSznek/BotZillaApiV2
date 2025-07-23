import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Switch,
  FormControl,
  FormControlLabel,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Card,
  CardContent,
  CardHeader,
  Divider
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Save as SaveIcon,
  Storage as StorageIcon,
  Api as ApiIcon,
  Security as SecurityIcon,
  CloudSync as SyncIcon,
  Info as InfoIcon
} from '@mui/icons-material';

const SystemConfigTab = () => {
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // System configuration states
  const [config, setConfig] = useState({
    database: {
      autoBackup: true,
      backupInterval: 24,
      maxConnections: 100
    },
    api: {
      rateLimit: 1000,
      enableCors: true,
      logLevel: 'info',
      cacheEnabled: true
    },
    security: {
      jwtExpiration: 24,
      passwordMinLength: 6,
      enableTwoFactor: false
    },
    atticTech: {
      syncEnabled: true,
      syncInterval: 60,
      maxRetries: 5
    }
  });

  const handleConfigChange = (section: string, field: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...(prev as any)[section],
        [field]: value
      }
    }));
  };

  const handleSaveConfig = async () => {
    try {
      setLoading(true);
      console.log('Saving configuration:', config);
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSuccess('Configuration saved successfully');
    } catch (error: any) {
      setError('Error saving configuration: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm('Are you sure you want to reset all settings to default values?')) {
      setConfig({
        database: {
          autoBackup: true,
          backupInterval: 24,
          maxConnections: 100
        },
        api: {
          rateLimit: 1000,
          enableCors: true,
          logLevel: 'info',
          cacheEnabled: true
        },
        security: {
          jwtExpiration: 24,
          passwordMinLength: 6,
          enableTwoFactor: false
        },
        atticTech: {
          syncEnabled: true,
          syncInterval: 60,
          maxRetries: 5
        }
      });
      setSuccess('Configuration reset to defaults');
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <SettingsIcon sx={{ mr: 1, fontSize: 24 }} />
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
            System Configuration
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={handleResetDefaults}
            disabled={loading}
          >
            Reset Defaults
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSaveConfig}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Configuration'}
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

      {/* System Information */}
      <Card sx={{ mb: 3 }}>
        <CardHeader
          avatar={<InfoIcon />}
          title="System Information"
          subheader="Current system status"
        />
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography><strong>Version:</strong> 2.0.0</Typography>
            <Typography><strong>Environment:</strong> Production</Typography>
            <Typography><strong>Last Backup:</strong> 2024-01-20 10:30:00</Typography>
            <Typography><strong>Uptime:</strong> 15 days, 8 hours</Typography>
            <Divider sx={{ my: 1 }} />
            <Typography><strong>Total Users:</strong> 25</Typography>
            <Typography><strong>Total Estimates:</strong> 1,250</Typography>
            <Typography><strong>Total Branches:</strong> 8</Typography>
            <Typography><strong>Total Salespersons:</strong> 15</Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Database Configuration */}
      <Card sx={{ mb: 3 }}>
        <CardHeader
          avatar={<StorageIcon />}
          title="Database Configuration"
          subheader="Database connection and backup settings"
        />
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={config.database.autoBackup}
                  onChange={(e) => handleConfigChange('database', 'autoBackup', e.target.checked)}
                />
              }
              label="Auto Backup"
            />
            <TextField
              label="Backup Interval (hours)"
              type="number"
              value={config.database.backupInterval}
              onChange={(e) => handleConfigChange('database', 'backupInterval', Number(e.target.value))}
              size="small"
              sx={{ maxWidth: 300 }}
            />
            <TextField
              label="Max Connections"
              type="number"
              value={config.database.maxConnections}
              onChange={(e) => handleConfigChange('database', 'maxConnections', Number(e.target.value))}
              size="small"
              sx={{ maxWidth: 300 }}
            />
          </Box>
        </CardContent>
      </Card>

      {/* API Configuration */}
      <Card sx={{ mb: 3 }}>
        <CardHeader
          avatar={<ApiIcon />}
          title="API Configuration"
          subheader="API settings and rate limiting"
        />
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Rate Limit (requests/hour)"
              type="number"
              value={config.api.rateLimit}
              onChange={(e) => handleConfigChange('api', 'rateLimit', Number(e.target.value))}
              size="small"
              sx={{ maxWidth: 300 }}
            />
            <FormControl size="small" sx={{ maxWidth: 300 }}>
              <InputLabel>Log Level</InputLabel>
              <Select
                value={config.api.logLevel}
                onChange={(e) => handleConfigChange('api', 'logLevel', e.target.value)}
                label="Log Level"
              >
                <MenuItem value="error">Error</MenuItem>
                <MenuItem value="warn">Warning</MenuItem>
                <MenuItem value="info">Info</MenuItem>
                <MenuItem value="debug">Debug</MenuItem>
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={config.api.enableCors}
                  onChange={(e) => handleConfigChange('api', 'enableCors', e.target.checked)}
                />
              }
              label="Enable CORS"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={config.api.cacheEnabled}
                  onChange={(e) => handleConfigChange('api', 'cacheEnabled', e.target.checked)}
                />
              }
              label="Enable Cache"
            />
          </Box>
        </CardContent>
      </Card>

      {/* Security Configuration */}
      <Card sx={{ mb: 3 }}>
        <CardHeader
          avatar={<SecurityIcon />}
          title="Security Configuration"
          subheader="Authentication and security settings"
        />
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="JWT Expiration (hours)"
              type="number"
              value={config.security.jwtExpiration}
              onChange={(e) => handleConfigChange('security', 'jwtExpiration', Number(e.target.value))}
              size="small"
              sx={{ maxWidth: 300 }}
            />
            <TextField
              label="Password Min Length"
              type="number"
              value={config.security.passwordMinLength}
              onChange={(e) => handleConfigChange('security', 'passwordMinLength', Number(e.target.value))}
              size="small"
              sx={{ maxWidth: 300 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={config.security.enableTwoFactor}
                  onChange={(e) => handleConfigChange('security', 'enableTwoFactor', e.target.checked)}
                />
              }
              label="Enable 2FA"
            />
          </Box>
        </CardContent>
      </Card>

      {/* Attic Tech Integration */}
      <Card sx={{ mb: 3 }}>
        <CardHeader
          avatar={<SyncIcon />}
          title="Attic Tech Integration"
          subheader="External API synchronization settings"
        />
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={config.atticTech.syncEnabled}
                  onChange={(e) => handleConfigChange('atticTech', 'syncEnabled', e.target.checked)}
                />
              }
              label="Enable Sync"
            />
            <TextField
              label="Sync Interval (minutes)"
              type="number"
              value={config.atticTech.syncInterval}
              onChange={(e) => handleConfigChange('atticTech', 'syncInterval', Number(e.target.value))}
              size="small"
              sx={{ maxWidth: 300 }}
            />
            <TextField
              label="Max Retries"
              type="number"
              value={config.atticTech.maxRetries}
              onChange={(e) => handleConfigChange('atticTech', 'maxRetries', Number(e.target.value))}
              size="small"
              sx={{ maxWidth: 300 }}
            />
          </Box>
        </CardContent>
      </Card>

      {/* Warning Notice */}
      <Alert severity="warning">
        <Typography variant="body2">
          <strong>Important:</strong> Changes to system configuration may require a server restart to take effect. 
          Please ensure you have proper backups before making critical changes.
        </Typography>
      </Alert>
    </Box>
  );
};

export default SystemConfigTab; 