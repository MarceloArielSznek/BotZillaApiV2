import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isDevelopment = mode === 'development'
  const isProduction = mode === 'production'
  
  // Configuración específica por entorno
  const serverConfig = isDevelopment ? {
    host: '0.0.0.0',
    port: 5173,
    cors: true,
    // 🚀 PROXY para eliminar problemas de CORS en desarrollo
    proxy: {
      '/api': {
        target: 'http://localhost:3333',
        changeOrigin: true,
        secure: false,
        configure: (proxy, options) => {
          console.log('🔗 Proxy configurado: /api -> http://localhost:3333')
        }
      },
      '/health': {
        target: 'http://localhost:3333',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:3333',
        changeOrigin: true,
        secure: false,
        ws: true, // Habilitar WebSocket
        rewrite: (path) => path, // No reescribir la ruta
        configure: (proxy, options) => {
          proxy.on('proxyReqWs', (proxyReq, req, socket) => {
            console.log('🔌 WebSocket proxy request:', req.url);
          });
          proxy.on('error', (err, req, res) => {
            console.error('❌ Proxy error:', err);
          });
          proxy.on('open', (proxySocket) => {
            console.log('✅ WebSocket proxy connection opened');
          });
          proxy.on('close', (res, socket, head) => {
            console.log('🔌 WebSocket proxy connection closed');
          });
          console.log('🔗 Proxy configurado: /socket.io -> http://localhost:3333 (WebSocket enabled)')
        }
      }
    },
    // Hot reload más agresivo en desarrollo
    hmr: {
      overlay: true
    }
  } : {
    host: 'localhost',
    port: 5173,
    cors: false,
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: serverConfig,
    // Configuración de build específica por entorno
    build: {
      outDir: 'dist',
      sourcemap: isDevelopment,
      minify: isProduction,
      // En desarrollo, builds más rápidos
      target: isDevelopment ? 'es2020' : 'es2015',
      rollupOptions: {
        output: {
          manualChunks: isProduction ? {
            vendor: ['react', 'react-dom'],
            mui: ['@mui/material', '@mui/icons-material'],
          } : undefined,
        },
      },
    },
    // Variables de entorno disponibles en el código
    define: {
      __DEV__: isDevelopment,
      __PROD__: isProduction,
      __MODE__: JSON.stringify(mode),
    },
  }
})