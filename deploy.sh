#!/bin/bash

# ========================================
# SCRIPT DE DESPLIEGUE - BOTZILLA API V2
# ========================================

echo "🚀 Iniciando despliegue de BotZilla API V2..."

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para imprimir mensajes
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar si estamos en el directorio correcto
if [ ! -f "backend/package.json" ]; then
    print_error "No se encontró backend/package.json. Ejecuta este script desde la raíz del proyecto."
    exit 1
fi

# ========================================
# PASO 1: INSTALAR DEPENDENCIAS
# ========================================
print_status "Instalando dependencias del backend..."
cd backend
npm install --production

if [ $? -ne 0 ]; then
    print_error "Error instalando dependencias del backend"
    exit 1
fi

print_status "Instalando dependencias del frontend..."
cd ../frontend
npm install

if [ $? -ne 0 ]; then
    print_error "Error instalando dependencias del frontend"
    exit 1
fi

# ========================================
# PASO 2: CONFIGURAR BASE DE DATOS
# ========================================
print_status "Configurando base de datos PostgreSQL..."

# Verificar si PostgreSQL está instalado
if ! command -v psql &> /dev/null; then
    print_error "PostgreSQL no está instalado. Instálalo primero."
    exit 1
fi

# Crear usuario y base de datos (ejecutar como postgres)
print_warning "Ejecutando comandos de base de datos como usuario postgres..."

# Crear usuario de base de datos
sudo -u postgres psql -c "CREATE USER botzilla_user WITH PASSWORD 'TU_PASSWORD_SEGURO_AQUI';" 2>/dev/null || print_warning "Usuario botzilla_user ya existe"

# Crear base de datos
sudo -u postgres psql -c "CREATE DATABASE botzilla_prod OWNER botzilla_user;" 2>/dev/null || print_warning "Base de datos botzilla_prod ya existe"

# Dar permisos al usuario
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE botzilla_prod TO botzilla_user;"

print_status "Base de datos configurada correctamente"

# ========================================
# PASO 3: CONFIGURAR VARIABLES DE ENTORNO
# ========================================
print_status "Configurando variables de entorno..."

cd ../backend

# Verificar si existe el archivo .env
if [ ! -f ".env" ]; then
    if [ -f "env.production.example" ]; then
        cp env.production.example .env
        print_warning "Archivo .env creado desde ejemplo. ¡IMPORTANTE: Edita el archivo .env con tus credenciales reales!"
    else
        print_error "No se encontró archivo .env ni env.production.example"
        exit 1
    fi
fi

# ========================================
# PASO 4: EJECUTAR MIGRACIONES
# ========================================
print_status "Ejecutando migraciones de base de datos..."

# Verificar si sequelize-cli está disponible
if [ -f "node_modules/.bin/sequelize-cli" ]; then
    npx sequelize-cli db:migrate
else
    print_warning "sequelize-cli no encontrado. Ejecuta las migraciones manualmente."
fi

# ========================================
# PASO 5: EJECUTAR SEEDS
# ========================================
print_status "Ejecutando seeds de base de datos..."
npm run seed

# ========================================
# PASO 6: CONFIGURAR PM2
# ========================================
print_status "Configurando PM2 para gestión de procesos..."

# Verificar si PM2 está instalado
if ! command -v pm2 &> /dev/null; then
    print_status "Instalando PM2..."
    npm install -g pm2
fi

# Crear archivo de configuración PM2
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'botzilla-api',
    script: 'src/server.js',
    cwd: './backend',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF

# Crear directorio de logs
mkdir -p backend/logs

# ========================================
# PASO 7: CONFIGURAR NGINX (OPCIONAL)
# ========================================
print_status "Configurando Nginx..."

# Crear configuración de Nginx
sudo tee /etc/nginx/sites-available/botzilla << EOF
server {
    listen 80;
    server_name tudominio.com www.tudominio.com;

    # Redirigir a HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tudominio.com www.tudominio.com;

    # Configuración SSL (configurar después)
    # ssl_certificate /path/to/cert.pem;
    # ssl_certificate_key /path/to/key.pem;

    # API Backend
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Frontend
    location / {
        root /var/www/botzilla/frontend/dist;
        try_files \$uri \$uri/ /index.html;
        
        # Headers de seguridad
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "no-referrer-when-downgrade" always;
        add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    }

    # Configuración de seguridad
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
}
EOF

# Habilitar sitio
sudo ln -sf /etc/nginx/sites-available/botzilla /etc/nginx/sites-enabled/

# Verificar configuración de Nginx
sudo nginx -t

if [ $? -eq 0 ]; then
    sudo systemctl reload nginx
    print_status "Nginx configurado correctamente"
else
    print_error "Error en la configuración de Nginx"
fi

# ========================================
# PASO 8: INICIAR APLICACIÓN
# ========================================
print_status "Iniciando aplicación con PM2..."

cd backend
pm2 start ecosystem.config.js

if [ $? -eq 0 ]; then
    print_status "Aplicación iniciada correctamente"
    pm2 save
    pm2 startup
    print_status "PM2 configurado para iniciar automáticamente"
else
    print_error "Error iniciando la aplicación"
    exit 1
fi

# ========================================
# PASO 9: CONFIGURAR FIREWALL
# ========================================
print_status "Configurando firewall..."

# Permitir puertos necesarios
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw --force enable

print_status "Firewall configurado"

# ========================================
# FINALIZACIÓN
# ========================================
echo ""
echo "🎉 ¡DESPLIEGUE COMPLETADO!"
echo ""
echo "📋 PRÓXIMOS PASOS:"
echo "1. Edita el archivo backend/.env con tus credenciales reales"
echo "2. Configura tu dominio en GoDaddy para apuntar a este servidor"
echo "3. Instala certificado SSL con Let's Encrypt:"
echo "   sudo certbot --nginx -d tudominio.com -d www.tudominio.com"
echo "4. Construye el frontend: cd frontend && npm run build"
echo "5. Copia los archivos del frontend a /var/www/botzilla/frontend/dist"
echo ""
echo "🔗 URLs:"
echo "   API: https://tudominio.com/api"
echo "   Frontend: https://tudominio.com"
echo ""
echo "📊 Comandos útiles:"
echo "   pm2 status          # Ver estado de la aplicación"
echo "   pm2 logs botzilla-api # Ver logs"
echo "   pm2 restart botzilla-api # Reiniciar aplicación"
echo ""
