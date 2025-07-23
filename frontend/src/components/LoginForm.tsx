import React, { useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { motion } from 'framer-motion';
import {
  Box,
  TextField,
  Button,
  Typography,
  Container,
  Paper,
  IconButton,
  InputAdornment,
  Alert,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const LoginForm = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const formik = useFormik({
    initialValues: {
      email: '',
      password: '',
    },
    validationSchema: Yup.object({
      email: Yup.string()
        .email('Invalid email')
        .required('Email is required'),
      password: Yup.string()
        .min(6, 'Password must be at least 6 characters')
        .required('Password is required'),
    }),
    onSubmit: async (values) => {
      try {
        await login(values.email, values.password);
        const audio = new Audio('/sounds/mario-coin.mp3');
        audio.play();
        navigate('/dashboard');
      } catch (err) {
        setError('Oops! Invalid credentials');
      }
    },
  });

  return (
    <Container component="main" maxWidth="sm"> {/* Cambiado de 'xs' a 'sm' para 20% más grande */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Paper
          elevation={6}
          sx={{
            mt: 8,
            p: 6, // Aumentado el padding para más espacio interno
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* BotZilla Logo with effects */}
          <Box sx={{ position: 'relative', mb: 4, width: '100%', display: 'flex', justifyContent: 'center' }}>
            {/* Aura behind logo */}
            <Box
              sx={{
                position: 'absolute',
                width: '250px', // Mucho más grande
                height: '250px', // Mucho más grande
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255,107,107,0.3) 0%, rgba(255,107,107,0) 70%)',
                filter: 'blur(15px)', // Aumentado el blur para mantener proporción
                animation: 'pulse 2s infinite',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            />
            
            {/* Logo container with float animation */}
            <motion.div
              whileHover={{ 
                scale: 1.1, 
                rotate: [0, -5, 5, -5, 0],
                transition: { duration: 0.5 }
              }}
              whileTap={{ scale: 0.9 }}
              animate={{
                y: [-8, 8, -8], // Aumentado el rango de flotación
                transition: {
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut"
                }
              }}
            >
              <Box
                component="img"
                src="/botzilla-logo.png"
                alt="BotZilla"
                sx={{
                  width: 200, // Mucho más grande
                  height: 200, // Mucho más grande
                  position: 'relative',
                  zIndex: 2,
                  filter: 'drop-shadow(0 0 15px rgba(255,107,107,0.5))', // Aumentado el shadow
                }}
              />
            </motion.div>

            {/* Particles around logo */}
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                style={{
                  position: 'absolute',
                  width: '12px', // Partículas más grandes
                  height: '12px', // Partículas más grandes
                  borderRadius: '50%',
                  background: 'linear-gradient(45deg, #FF6B6B, #FFB302)',
                  top: '50%',
                  left: '50%',
                }}
                animate={{
                  x: [0, Math.cos(i * 45 * Math.PI / 180) * 80], // Radio de órbita más grande
                  y: [0, Math.sin(i * 45 * Math.PI / 180) * 80], // Radio de órbita más grande
                  opacity: [0, 1, 0],
                  scale: [1, 1.5, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: "easeInOut"
                }}
              />
            ))}
          </Box>

          <Typography
            component="h1"
            variant="h5"
            sx={{
              mb: 4,
              textAlign: 'center',
              textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
            }}
          >
            LOGIN
          </Typography>

          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Alert 
                severity="error" 
                sx={{ 
                  mb: 2, 
                  width: '100%',
                  border: '2px solid #FF4444',
                  backgroundColor: 'rgba(255, 68, 68, 0.1)',
                }}
              >
                {error}
              </Alert>
            </motion.div>
          )}

          <form onSubmit={formik.handleSubmit} style={{ width: '100%' }}>
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <TextField
                fullWidth
                id="email"
                name="email"
                label="Email"
                value={formik.values.email}
                onChange={formik.handleChange}
                error={formik.touched.email && Boolean(formik.errors.email)}
                helperText={formik.touched.email && formik.errors.email}
                sx={{ mb: 3 }}
              />
            </motion.div>

            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <TextField
                fullWidth
                id="password"
                name="password"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={formik.values.password}
                onChange={formik.handleChange}
                error={formik.touched.password && Boolean(formik.errors.password)}
                helperText={formik.touched.password && formik.errors.password}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 4 }}
              />
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                sx={{
                  mt: 2,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                LOG IN
              </Button>
            </motion.div>
          </form>
        </Paper>
      </motion.div>
    </Container>
  );
};

export default LoginForm; 