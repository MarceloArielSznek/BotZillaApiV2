import React, { useState } from 'react';
import employeeRegistrationService, { 
  type EmployeeRegistrationData 
} from '../services/employeeRegistrationService';
import PublicLayout from '../layouts/PublicLayout';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  Alert,
  Paper,
  Divider,
  Link,
  Chip,
  InputAdornment,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Telegram as TelegramIcon,
  Save as SaveIcon,
  Clear as ClearIcon,
  ContentCopy as CopyIcon
} from '@mui/icons-material';

// Interface ya importada desde el servicio

const EmployeeRegistration: React.FC = () => {
  const [formData, setFormData] = useState<EmployeeRegistrationData>({
    firstName: '',
    lastName: '',
    nickname: '',
    email: '',
    phoneNumber: '',
    telegramId: ''
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [telegramBotUrl] = useState(employeeRegistrationService.getTelegramBotUrl());

  // Manejar cambios en los campos del formulario
  const handleInputChange = (field: keyof EmployeeRegistrationData) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
    
    // Limpiar mensajes de error/éxito cuando el usuario empiece a escribir
    if (error) setError(null);
    if (success) setSuccess(null);
  };

  // Validar formulario usando el servicio
  const validateForm = (): boolean => {
    if (!employeeRegistrationService.isFormComplete(formData)) {
      setError('Please fill in all required fields');
      return false;
    }

    // Validar formato de email
    if (!employeeRegistrationService.validateEmail(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }

    // Validar formato de teléfono
    if (!employeeRegistrationService.validatePhoneNumber(formData.phoneNumber)) {
      setError('Please enter a valid phone number');
      return false;
    }

    return true;
  };

  // Manejar envío del formulario
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Usar el servicio para enviar los datos
      const result = await employeeRegistrationService.registerEmployee(formData);
      
      if (result.success) {
        const fullName = employeeRegistrationService.formatFullName(
          formData.firstName, 
          formData.lastName, 
          formData.nickname
        );
        
        setSuccess(
          `Registration submitted successfully for ${fullName}! ` +
          `Registration ID: ${result.data?.registrationId}. ` +
          `HR will review and contact you within 24 hours.`
        );
        
        // Limpiar formulario después del éxito
        setFormData({
          firstName: '',
          lastName: '',
          nickname: '',
          email: '',
          phoneNumber: '',
          telegramId: ''
        });
      } else {
        setError(result.message || 'Registration failed. Please try again.');
      }

    } catch (err: any) {
      setError(err.message || 'Failed to submit registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Limpiar formulario
  const handleClear = () => {
    setFormData({
      firstName: '',
      lastName: '',
      nickname: '',
      email: '',
      phoneNumber: '',
      telegramId: ''
    });
    setError(null);
    setSuccess(null);
  };

  // Copiar URL del bot de Telegram
  const copyTelegramUrl = async () => {
    try {
      await navigator.clipboard.writeText(telegramBotUrl);
      setSuccess('Telegram bot URL copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  return (
    <PublicLayout title="" showLoginButton={true}>
      <Box sx={{ 
        maxWidth: { xs: '100%', sm: 600, md: 700 }, 
        mx: 'auto',
        px: { xs: 1, sm: 2 }
      }}>
        {/* Header */}
        <Box sx={{ mb: { xs: 2, sm: 3 }, textAlign: 'center' }}>
          <Typography 
            variant="h4" 
            component="h1" 
            fontWeight="bold" 
            gutterBottom
            sx={{ fontSize: { xs: '1.75rem', sm: '2.125rem' } }}
          >
            Employee Registration
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ px: { xs: 2, sm: 0 } }}>
            Fill the form below to register as an employee.
          </Typography>
        </Box>

        {/* Error/Success Messages */}
        {error && (
          <Alert severity="error" sx={{ mb: 2, mx: { xs: 1, sm: 0 } }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2, mx: { xs: 1, sm: 0 } }}>
            {success}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          {/* Personal Information Card */}
          <Card elevation={1} sx={{ mb: 3, borderRadius: 3, bgcolor: 'background.default' }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" color="text.primary">
                  Personal Information
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  fullWidth
                  required
                  label="First Name"
                  value={formData.firstName}
                  onChange={handleInputChange('firstName')}
                  variant="outlined"
                  placeholder="Enter your first name"
                  size="medium"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
                
                <TextField
                  fullWidth
                  required
                  label="Last Name"
                  value={formData.lastName}
                  onChange={handleInputChange('lastName')}
                  variant="outlined"
                  placeholder="Enter your last name"
                  size="medium"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
                
                <TextField
                  fullWidth
                  label="Nickname (Optional)"
                  value={formData.nickname}
                  onChange={handleInputChange('nickname')}
                  variant="outlined"
                  placeholder="Preferred name or alias"
                  size="medium"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Box>
            </CardContent>
          </Card>

          {/* Contact Information Card */}
          <Card elevation={1} sx={{ mb: 3, borderRadius: 3, bgcolor: 'background.default' }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <EmailIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" color="text.primary">
                  Contact Information
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  fullWidth
                  required
                  type="email"
                  label="Email Address"
                  value={formData.email}
                  onChange={handleInputChange('email')}
                  variant="outlined"
                  placeholder="your.email@example.com"
                  size="medium"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
                
                <TextField
                  fullWidth
                  required
                  label="Phone Number"
                  value={formData.phoneNumber}
                  onChange={handleInputChange('phoneNumber')}
                  variant="outlined"
                  placeholder="+1 (555) 123-4567"
                  size="medium"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Box>
            </CardContent>
          </Card>

          {/* Telegram Integration Card */}
          <Card elevation={1} sx={{ mb: 3, borderRadius: 3, bgcolor: 'background.default' }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TelegramIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" color="text.primary">
                  Telegram Integration
                </Typography>
                <Chip 
                  label="Required" 
                  size="small" 
                  variant="filled"
                  color="error"
                  sx={{ ml: 'auto' }}
                />
              </Box>
              
              {/* Telegram Instructions */}
              <Paper 
                sx={{ 
                  p: 2, 
                  mb: 2, 
                  bgcolor: 'red.light',
                  color: 'error.contrastText',
                  borderRadius: 2,
                  border: '2px solid',
                  borderColor: 'error.main'
                }}
              >
                <Typography variant="body2" fontWeight="bold" gutterBottom>
                  Get your Telegram ID:
                </Typography>
                <Typography variant="body2" sx={{ mb: 2, opacity: 0.9 }}>
                  After you set up your Telegram account, click the link below to talk to our bot and get your Telegram ID.
                </Typography>
                
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: { xs: 'column', sm: 'row' },
                  gap: 1, 
                  alignItems: { xs: 'stretch', sm: 'center' }
                }}>
                  <Button
                    variant="contained"
                    color="secondary"
                    startIcon={<TelegramIcon />}
                    href={telegramBotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="medium"
                    sx={{ borderRadius: 2, fontWeight: 'bold' }}
                  >
                    Get My Telegram ID
                  </Button>
                </Box>
              </Paper>
              
              <TextField
                fullWidth
                required
                label="Your Telegram ID"
                value={formData.telegramId}
                onChange={handleInputChange('telegramId')}
                variant="outlined"
                placeholder="Paste your Telegram ID from the bot here"
                size="medium"
                helperText="Required - Get this from the Telegram bot above"
                error={!!error && !formData.telegramId}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2, 
            mb: 3,
            px: { xs: 1, sm: 0 }
          }}>
            <Button
              variant="outlined"
              startIcon={<ClearIcon />}
              onClick={handleClear}
              disabled={loading}
              size="large"
              sx={{ 
                borderRadius: 3,
                py: 1.5,
                order: { xs: 2, sm: 1 }
              }}
            >
              Clear Form
            </Button>
            <Button
              type="submit"
              variant="contained"
              startIcon={<SaveIcon />}
              disabled={loading}
              size="large"
              sx={{ 
                borderRadius: 3,
                py: 1.5,
                flexGrow: 1,
                order: { xs: 1, sm: 2 }
              }}
            >
              {loading ? 'Submitting...' : 'Register'}
            </Button>
          </Box>
        </form>

        {/* What happens next */}
        <Card elevation={1} sx={{ borderRadius: 3, bgcolor: 'background.default' }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography variant="h6" gutterBottom color="text.primary" sx={{ display: 'flex', alignItems: 'center' }}>
              📋 What happens next?
            </Typography>
            <Box component="ul" sx={{ pl: 2, m: 0 }}>
              <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                Your registration will be reviewed by HR
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                You'll receive a confirmation email within 24 hours
              </Typography>

              <Typography component="li" variant="body2" color="text.secondary">
                Questions? Contact marcelo@atticprojectscompany.com
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </PublicLayout>
  );
};

export default EmployeeRegistration;
