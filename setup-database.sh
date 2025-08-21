#!/bin/bash

# ========================================
# SCRIPT DE CONFIGURACIÓN DE BASE DE DATOS
# BOTZILLA API V2 - POSTGRESQL
# ========================================

echo "🗄️ Configurando base de datos PostgreSQL para BotZilla API V2..."

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ========================================
# PASO 1: INSTALAR POSTGRESQL
# ========================================
print_status "Verificando instalación de PostgreSQL..."

if ! command -v psql &> /dev/null; then
    print_status "Instalando PostgreSQL..."
    
    # Actualizar repositorios
    sudo apt update
    
    # Instalar PostgreSQL
    sudo apt install -y postgresql postgresql-contrib
    
    if [ $? -eq 0 ]; then
        print_status "PostgreSQL instalado correctamente"
    else
        print_error "Error instalando PostgreSQL"
        exit 1
    fi
else
    print_status "PostgreSQL ya está instalado"
fi

# ========================================
# PASO 2: CONFIGURAR POSTGRESQL
# ========================================
print_status "Configurando PostgreSQL..."

# Iniciar servicio PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verificar que el servicio esté corriendo
if sudo systemctl is-active --quiet postgresql; then
    print_status "Servicio PostgreSQL iniciado correctamente"
else
    print_error "Error iniciando servicio PostgreSQL"
    exit 1
fi

# ========================================
# PASO 3: CREAR USUARIO Y BASE DE DATOS
# ========================================
print_status "Creando usuario y base de datos..."

# Generar contraseña segura
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

# Crear usuario de base de datos
sudo -u postgres psql -c "CREATE USER botzilla_user WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || print_warning "Usuario botzilla_user ya existe"

# Crear base de datos
sudo -u postgres psql -c "CREATE DATABASE botzilla_prod OWNER botzilla_user;" 2>/dev/null || print_warning "Base de datos botzilla_prod ya existe"

# Crear esquema
sudo -u postgres psql -d botzilla_prod -c "CREATE SCHEMA IF NOT EXISTS botzilla AUTHORIZATION botzilla_user;"

# Dar permisos al usuario
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE botzilla_prod TO botzilla_user;"
sudo -u postgres psql -d botzilla_prod -c "GRANT ALL ON SCHEMA botzilla TO botzilla_user;"
sudo -u postgres psql -d botzilla_prod -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA botzilla TO botzilla_user;"
sudo -u postgres psql -d botzilla_prod -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA botzilla TO botzilla_user;"
sudo -u postgres psql -d botzilla_prod -c "ALTER DEFAULT PRIVILEGES IN SCHEMA botzilla GRANT ALL ON TABLES TO botzilla_user;"
sudo -u postgres psql -d botzilla_prod -c "ALTER DEFAULT PRIVILEGES IN SCHEMA botzilla GRANT ALL ON SEQUENCES TO botzilla_user;"

print_status "Base de datos configurada correctamente"

# ========================================
# PASO 4: CONFIGURAR ACCESO LOCAL
# ========================================
print_status "Configurando acceso local a PostgreSQL..."

# Crear backup del archivo de configuración
sudo cp /etc/postgresql/*/main/pg_hba.conf /etc/postgresql/*/main/pg_hba.conf.backup

# Configurar acceso local (solo desde 127.0.0.1)
sudo tee /etc/postgresql/*/main/pg_hba.conf << EOF
# Database administrative login by Unix domain socket
local   all             postgres                                peer

# TYPE  DATABASE        USER            ADDRESS                 METHOD

# "local" is for Unix domain socket connections only
local   all             all                                     peer
# IPv4 local connections:
host    all             all             127.0.0.1/32            md5
# IPv6 local connections:
host    all             all             ::1/128                 md5
# Allow replication connections from localhost, by a user with the
# replication privilege.
local   replication     all                                     peer
host    replication     all             127.0.0.1/32            md5
host    replication     all             ::1/128                 md5
EOF

# Reiniciar PostgreSQL para aplicar cambios
sudo systemctl restart postgresql

print_status "Acceso local configurado correctamente"

# ========================================
# PASO 5: CREAR ARCHIVO DE CONFIGURACIÓN
# ========================================
print_status "Creando archivo de configuración de base de datos..."

# Crear archivo con las credenciales
cat > database-config.txt << EOF
========================================
CONFIGURACIÓN DE BASE DE DATOS - BOTZILLA
========================================

Base de datos creada exitosamente!

📊 DATOS DE CONEXIÓN:
Host: 127.0.0.1
Puerto: 5432
Base de datos: botzilla_prod
Usuario: botzilla_user
Contraseña: $DB_PASSWORD
Esquema: botzilla

🔒 SEGURIDAD:
- Solo acceso local (127.0.0.1)
- Usuario con permisos mínimos necesarios
- Contraseña generada automáticamente

📝 PRÓXIMOS PASOS:
1. Copia estos datos al archivo .env del backend
2. Ejecuta las migraciones: npx sequelize-cli db:migrate
3. Ejecuta los seeds: npm run seed

⚠️ IMPORTANTE:
- Guarda esta contraseña en un lugar seguro
- No compartas estas credenciales
- La base de datos solo es accesible desde el servidor local

EOF

print_status "Archivo de configuración creado: database-config.txt"

# ========================================
# PASO 6: VERIFICAR CONEXIÓN
# ========================================
print_status "Verificando conexión a la base de datos..."

# Probar conexión
PGPASSWORD=$DB_PASSWORD psql -h 127.0.0.1 -U botzilla_user -d botzilla_prod -c "SELECT version();" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    print_status "✅ Conexión a la base de datos verificada correctamente"
else
    print_error "❌ Error verificando conexión a la base de datos"
    exit 1
fi

# ========================================
# FINALIZACIÓN
# ========================================
echo ""
echo "🎉 ¡CONFIGURACIÓN DE BASE DE DATOS COMPLETADA!"
echo ""
echo "📋 RESUMEN:"
echo "   ✅ PostgreSQL instalado y configurado"
echo "   ✅ Base de datos 'botzilla_prod' creada"
echo "   ✅ Usuario 'botzilla_user' creado"
echo "   ✅ Esquema 'botzilla' creado"
echo "   ✅ Acceso local configurado"
echo "   ✅ Contraseña generada automáticamente"
echo ""
echo "📄 Archivo de configuración: database-config.txt"
echo ""
echo "🔗 Para conectar desde la aplicación:"
echo "   DB_HOST=127.0.0.1"
echo "   DB_PORT=5432"
echo "   DB_NAME=botzilla_prod"
echo "   DB_USER=botzilla_user"
echo "   DB_PASSWORD=$DB_PASSWORD"
echo "   DB_SCHEMA=botzilla"
echo ""
