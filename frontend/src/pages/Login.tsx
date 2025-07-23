import React from 'react';
import { Box } from '@mui/material';
import LoginForm from '../components/LoginForm';
import { motion } from 'framer-motion';

const Login = () => {
  // Crear partículas aleatorias para el fondo
  const particles = Array.from({ length: 50 }).map((_, i) => ({
    id: i,
    size: Math.random() * 4 + 1,
    x: Math.random() * 100,
    y: Math.random() * 100,
    duration: Math.random() * 20 + 10,
    delay: Math.random() * 2,
  }));

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0A1929 0%, #132F4C 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Partículas de fondo */}
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          style={{
            position: 'absolute',
            width: particle.size,
            height: particle.size,
            borderRadius: '50%',
            backgroundColor: 'rgba(108, 99, 255, 0.2)',
            left: `${particle.x}%`,
            top: `${particle.y}%`,
          }}
          animate={{
            y: ['0%', '100%'],
            x: ['-10%', '10%'],
            opacity: [0.2, 0.8, 0.2],
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: particle.delay,
            ease: 'linear',
          }}
        />
      ))}

      {/* Círculo decorativo superior */}
      <Box
        sx={{
          position: 'absolute',
          top: '-20%',
          right: '-10%',
          width: '40%',
          height: '40%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(108,99,255,0.2) 0%, rgba(108,99,255,0) 70%)',
          filter: 'blur(40px)',
        }}
      />

      {/* Círculo decorativo inferior */}
      <Box
        sx={{
          position: 'absolute',
          bottom: '-20%',
          left: '-10%',
          width: '40%',
          height: '40%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,101,132,0.2) 0%, rgba(255,101,132,0) 70%)',
          filter: 'blur(40px)',
        }}
      />

      <LoginForm />
    </Box>
  );
};

export default Login; 