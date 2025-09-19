import React, { useState, useEffect } from 'react';
import employeeRegistrationService, { 
  type EmployeeRegistrationData,
  AVAILABLE_BRANCHES
} from '../services/employeeRegistrationService';
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
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Telegram as TelegramIcon,
  Save as SaveIcon,
  Clear as ClearIcon,
  ContentCopy as CopyIcon,
  Work as WorkIcon
} from '@mui/icons-material';

// Interface ya importada desde el servicio

const EmployeeRegistration: React.FC = () => {
  const [formData, setFormData] = useState<EmployeeRegistrationData>({
    firstName: '',
    lastName: '',
    street: '',
    city: '',
    state: '',
    zip: '',
    dateOfBirth: '',
    email: '',
    phoneNumber: '',
    telegramId: '',
    branch: '',
    role: ''
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [telegramBotUrl] = useState(employeeRegistrationService.getTelegramBotUrl());
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [registrationData, setRegistrationData] = useState<any>(null);
  const [redirectCountdown, setRedirectCountdown] = useState(10);

  // Efecto para manejar la lógica de Branch/Role
  useEffect(() => {
    if (formData.branch === 'Corporate') {
      // Si la rama es Corporate y el rol no está ya seteado, lo seteamos
      if (formData.role !== 'corporate') {
        setFormData(prev => ({ ...prev, role: 'corporate' }));
      }
    } else {
      // Si se cambia de Corporate a otra rama, y el rol era 'corporate', lo limpiamos
      if (formData.role === 'corporate') {
        setFormData(prev => ({ ...prev, role: '' }));
      }
    }
  }, [formData.branch, formData.role]);

  // Countdown y redirección automática
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (showSuccessModal && redirectCountdown > 0) {
      interval = setInterval(() => {
        setRedirectCountdown((prev) => prev - 1);
      }, 1000);
    } else if (showSuccessModal && redirectCountdown === 0) {
      // Redirigir al bot de Telegram
      window.location.href = telegramBotUrl;
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [showSuccessModal, redirectCountdown]);


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

    // Validar fecha de nacimiento
    if (!employeeRegistrationService.validateDateOfBirth(formData.dateOfBirth)) {
      setError('Please enter a valid date of birth (must be at least 16 years old)');
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
          formData.lastName
        );
        
        // Guardar datos de registro para el modal
        setRegistrationData({
          fullName,
          registrationId: result.data?.registrationId,
          email: formData.email
        });
        
        // Mostrar modal de éxito
        setShowSuccessModal(true);
        setRedirectCountdown(10); // Reset countdown
        
        // Limpiar formulario después del éxito
        setFormData({
          firstName: '',
          lastName: '',
          street: '',
          city: '',
          state: '',
          zip: '',
          dateOfBirth: '',
          email: '',
          phoneNumber: '',
          telegramId: '',
          branch: '',
          role: ''
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
      street: '',
      city: '',
      state: '',
      zip: '',
      dateOfBirth: '',
      email: '',
      phoneNumber: '',
      telegramId: '',
      branch: '',
      role: ''
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

        {/* Error Messages */}
        {error && (
          <Alert severity="error" sx={{ mb: 2, mx: { xs: 1, sm: 0 } }}>
            {error}
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
                  required
                  label="Street Address"
                  value={formData.street}
                  onChange={handleInputChange('street')}
                  variant="outlined"
                  placeholder="Enter your street address"
                  size="medium"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
                
                <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                  <TextField
                    fullWidth
                    required
                    label="City"
                    value={formData.city}
                    onChange={handleInputChange('city')}
                    variant="outlined"
                    placeholder="Enter your city"
                    size="medium"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />
                  
                  <TextField
                    required
                    label="State"
                    value={formData.state}
                    onChange={handleInputChange('state')}
                    variant="outlined"
                    placeholder="CA"
                    size="medium"
                    sx={{ 
                      '& .MuiOutlinedInput-root': { borderRadius: 2 },
                      minWidth: { xs: '100%', sm: '100px' },
                      maxWidth: { xs: '100%', sm: '120px' }
                    }}
                  />
                  
                  <TextField
                    required
                    label="Zip Code"
                    value={formData.zip}
                    onChange={handleInputChange('zip')}
                    variant="outlined"
                    placeholder="12345"
                    size="medium"
                    sx={{ 
                      '& .MuiOutlinedInput-root': { borderRadius: 2 },
                      minWidth: { xs: '100%', sm: '100px' },
                      maxWidth: { xs: '100%', sm: '120px' }
                    }}
                  />
                </Box>
                
                <TextField
                  fullWidth
                  required
                  label="Date of Birth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={handleInputChange('dateOfBirth')}
                  variant="outlined"
                  size="medium"
                  InputLabelProps={{
                    shrink: true,
                  }}
                  inputProps={{
                    max: new Date().toISOString().split('T')[0]
                  }}
                  sx={{ 
                    '& .MuiOutlinedInput-root': { 
                      borderRadius: 2,
                      backgroundColor: 'background.paper',
                      '& input[type="date"]': {
                        color: 'text.primary',
                        '&::-webkit-calendar-picker-indicator': {
                          filter: 'invert(0.5)',
                          cursor: 'pointer'
                        }
                      }
                    }
                  }}
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

          {/* Work Information Card */}
          <Card elevation={1} sx={{ mb: 3, borderRadius: 3, bgcolor: 'background.default' }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <WorkIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" color="text.primary">
                  Work Information
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControl fullWidth required size="medium">
                  <InputLabel>Branch</InputLabel>
                  <Select
                    value={formData.branch}
                    label="Branch"
                    onChange={(e) => setFormData(prev => ({ ...prev, branch: e.target.value as string }))}
                    sx={{ borderRadius: 2 }}
                  >
                    {AVAILABLE_BRANCHES.map((branch) => (
                      <MenuItem key={branch} value={branch}>
                        {branch}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <FormControl fullWidth required size="medium">
                  <InputLabel id="role-select-label">Role *</InputLabel>
                  <Select
                    labelId="role-select-label"
                    value={formData.role}
                    label="Role"
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as 'crew_member' | 'crew_leader' | 'salesperson' | 'corporate' }))}
                    disabled={formData.branch === 'Corporate'}
                    sx={{ borderRadius: 2 }}
                  >
                    <MenuItem value="crew_member">Crew Member</MenuItem>
                    <MenuItem value="crew_leader">Crew Leader</MenuItem>
                    <MenuItem value="salesperson">Salesperson</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </CardContent>
          </Card>

          {/* Telegram Integration Card */}
          <Card elevation={1} sx={{ mb: 3, borderRadius: 3, bgcolor: 'background.default' }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <TelegramIcon sx={{ mr: 1, color: '#0088cc', fontSize: '1.5rem' }} />
                <Typography variant="h6" color="text.primary" fontWeight="600">
                  Telegram Integration
                </Typography>
                <Chip 
                  label="Required" 
                  size="small" 
                  variant="filled"
                  color="error"
                  sx={{ ml: 'auto', fontWeight: 'bold' }}
                />
              </Box>
              
              {/* Step-by-step Instructions */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="body1" fontWeight="600" gutterBottom color="text.primary">
                  📱 How to get your Telegram ID:
                </Typography>
                
                <Box sx={{ pl: 2, mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1, display: 'flex', alignItems: 'flex-start' }}>
                    <span style={{ color: '#0088cc', fontWeight: 'bold', marginRight: '8px' }}>1.</span>
                    Make sure you have Telegram installed on your phone or computer
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1, display: 'flex', alignItems: 'flex-start' }}>
                    <span style={{ color: '#0088cc', fontWeight: 'bold', marginRight: '8px' }}>2.</span>
                    Click the button below to open our bot
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, display: 'flex', alignItems: 'flex-start' }}>
                    <span style={{ color: '#0088cc', fontWeight: 'bold', marginRight: '8px' }}>3.</span>
                    The bot will automatically send you your Telegram ID
                  </Typography>
                </Box>
                
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'center',
                  mb: 3
                }}>
                  <Button
                    variant="contained"
                    startIcon={<TelegramIcon />}
                    href={telegramBotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="large"
                    sx={{ 
                      borderRadius: 3,
                      px: 4,
                      py: 1.5,
                      bgcolor: '#0088cc',
                      '&:hover': {
                        bgcolor: '#006699'
                      },
                      fontWeight: 'bold',
                      fontSize: '1rem',
                      textTransform: 'none',
                      boxShadow: '0 4px 12px rgba(0, 136, 204, 0.3)'
                    }}
                  >
                    🚀 Get My Telegram ID
                  </Button> 
                </Box>
              </Box>
              
              <TextField
                fullWidth
                required
                label="Your Telegram ID"
                value={formData.telegramId}
                onChange={handleInputChange('telegramId')}
                variant="outlined"
                placeholder="Example: 123456789"
                size="medium"
                helperText="📋 Paste the ID number you received from our Telegram bot"
                error={!!error && !formData.telegramId}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <TelegramIcon sx={{ color: '#0088cc' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    borderRadius: 2,
                    '&.Mui-focused': {
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#0088cc'
                      }
                    }
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: '#0088cc'
                  }
                }}
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
                Questions? Contact marceloa@atticprojectscompany.com
              </Typography>
            </Box>
          </CardContent>
        </Card>

        {/* Modal de Éxito con Checkout Style */}
        <Dialog 
          open={showSuccessModal} 
          onClose={() => {}} // Prevenir cierre manual
          maxWidth="sm" 
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              textAlign: 'center',
              p: 2
            }
          }}
        >
          <DialogTitle sx={{ pb: 1 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              {/* Checkmark Icon */}
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  bgcolor: 'success.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '2rem'
                }}
              >
                ✓
              </Box>
              <Typography variant="h5" fontWeight="bold" color="success.main">
                Registration Successful!
              </Typography>
            </Box>
          </DialogTitle>
          
          <DialogContent sx={{ pt: 1 }}>
            {registrationData && (
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Welcome, {registrationData.fullName}!
                </Typography>
                
                <Paper sx={{ 
                  p: 2, 
                  mb: 2, 
                  bgcolor: 'primary.dark', 
                  borderRadius: 2,
                  border: 2,
                  borderColor: 'primary.dark'
                }}>
                  <Typography variant="body2" color="primary.contrastText" gutterBottom>
                    Your Registration ID
                  </Typography>
                  <Typography variant="h6" fontWeight="bold" color="primary.contrastText">
                    {registrationData.registrationId}
                  </Typography>
                </Paper>

                <Typography variant="body1" sx={{ mb: 2 }}>
                  Your registration has been submitted successfully!
                </Typography>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  • HR will review your application within 24 hours<br/>
                  • You'll receive a confirmation email at: <strong>{registrationData.email}</strong><br/>
                  • Please save your Registration ID for reference<br/>
                  • You'll be redirected to our Telegram bot for further assistance
                </Typography>

                {/* Countdown */}
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: 1, 
                  mt: 3,
                  p: 2,
                  bgcolor: 'primary.light',
                  borderRadius: 2,
                  color: 'primary.contrastText'
                }}>
                  <CircularProgress 
                    size={24} 
                    color="inherit" 
                    variant="determinate" 
                    value={(10 - redirectCountdown) * 10}
                  />
                  <Typography variant="body2">
                    Redirecting to Telegram Bot in {redirectCountdown} seconds...
                  </Typography>
                </Box>
              </Box>
            )}
          </DialogContent>
          
          <DialogActions sx={{ justifyContent: 'center', pt: 0 }}>
            <Button
              variant="contained"
              onClick={() => window.location.href = telegramBotUrl}
              size="large"
              sx={{ borderRadius: 3, px: 4 }}
            >
              Continue to Telegram Bot
            </Button>
          </DialogActions>
        </Dialog>
    </Box>
  );
};

export default EmployeeRegistration;
