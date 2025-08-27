#!/bin/bash

echo "🚀 Iniciando deployment de BotZilla API V2..."

# Cambiar al directorio del proyecto
cd /home/marcelo/apps/BotZillaApiV2

# Pull de los cambios más recientes
echo "📥 Actualizando código desde Git..."
git pull origin main

# Instalar dependencias del backend si es necesario
echo "📦 Verificando dependencias del backend..."
cd backend
npm install --production

# Reiniciar backend
echo "🔄 Reiniciando backend..."
pm2 restart botzilla-backend

# Volver al directorio raíz
cd ..

# Instalar dependencias del frontend
echo "📦 Verificando dependencias del frontend..."
cd frontend
npm install

# Build del frontend
echo "🔨 Construyendo frontend..."
npm run build

# Verificar que el build fue exitoso
if [ -f "dist/index.html" ]; then
    echo "✅ Build del frontend completado exitosamente"
else
    echo "❌ Error en el build del frontend"
    exit 1
fi

# Reiniciar frontend
echo "🔄 Reiniciando frontend..."
pm2 restart botzilla-frontend

# Verificar estado de los servicios
echo "📊 Estado de los servicios:"
pm2 status

echo "🎉 Deployment completado!"
echo "🌐 Sitio web: https://yallaprojects.com"
