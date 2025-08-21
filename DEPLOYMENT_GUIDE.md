# 🚀 GUÍA DE DESPLIEGUE - BOTZILLA API V2

## 📋 RESUMEN RÁPIDO

Esta guía te ayudará a desplegar BotZilla API V2 en tu servidor de DonWeb con máxima seguridad usando base de datos local (127.0.0.1).

**⏱️ Tiempo estimado:** 30-45 minutos  
**🔒 Seguridad:** Base de datos local + HTTPS + Rate limiting

---

## 🎯 PASOS DE DESPLIEGUE

### **PASO 1: PREPARAR EL SERVIDOR**

1. **Conectarse al servidor:**
   ```bash
   ssh usuario@tu-servidor.com
   ```

2. **Actualizar el sistema:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

3. **Instalar Node.js (si no está instalado):**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

### **PASO 2: SUBIR EL CÓDIGO**

1. **Clonar o subir el proyecto:**
   ```bash
   # Opción A: Clonar desde Git
   git clone https://github.com/tu-usuario/botzilla-api-v2.git
   cd botzilla-api-v2
   
   # Opción B: Subir archivos via FTP/SCP
   # Sube todos los archivos del proyecto a /home/usuario/botzilla-api-v2/
   ```

### **PASO 3: CONFIGURAR BASE DE DATOS**

1. **Ejecutar script de configuración de DB:**
   ```bash
   chmod +x setup-database.sh
   ./setup-database.sh
   ```

2. **Revisar configuración generada:**
   ```bash
   cat database-config.txt
   ```

### **PASO 4: CONFIGURAR VARIABLES DE ENTORNO**

1. **Crear archivo .env:**
   ```bash
   cd backend
   cp env.production.example .env
   nano .env
   ```

2. **Editar con tus credenciales reales:**
   ```env
   # Configuración del servidor
   NODE_ENV=production
   PORT=3000
   
   # Base de datos (usar datos del database-config.txt)
   DB_HOST=127.0.0.1
   DB_PORT=5432
   DB_NAME=botzilla_prod
   DB_USER=botzilla_user
   DB_PASSWORD=TU_PASSWORD_GENERADO
   DB_SCHEMA=botzilla
   DB_SSL=false
   
   # JWT (generar clave segura)
   JWT_SECRET=TU_JWT_SECRET_MUY_SEGURO_32_CARACTERES
   JWT_EXPIRES_IN=24h
   
   # Frontend URL (cambiar por tu dominio)
   FRONTEND_URL=https://tudominio.com
   
   # Otras configuraciones según necesites...
   ```

### **PASO 5: DESPLEGAR LA APLICACIÓN**

1. **Ejecutar script de despliegue:**
   ```bash
   cd ..
   chmod +x deploy.sh
   ./deploy.sh
   ```

### **PASO 6: CONFIGURAR DOMINIO**

1. **En GoDaddy, configurar DNS:**
   - Tipo: A
   - Nombre: @ (o subdominio)
   - Valor: IP de tu servidor

2. **Instalar certificado SSL:**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d tudominio.com -d www.tudominio.com
   ```

### **PASO 7: CONSTRUIR FRONTEND**

1. **Construir aplicación frontend:**
   ```bash
   cd frontend
   npm run build
   ```

2. **Copiar archivos al servidor web:**
   ```bash
   sudo mkdir -p /var/www/botzilla/frontend
   sudo cp -r dist/* /var/www/botzilla/frontend/
   sudo chown -R www-data:www-data /var/www/botzilla
   ```

---

## 🔧 CONFIGURACIÓN AVANZADA

### **Configurar Nginx manualmente (si es necesario):**

```bash
sudo nano /etc/nginx/sites-available/botzilla
```

```nginx
server {
    listen 80;
    server_name tudominio.com www.tudominio.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tudominio.com www.tudominio.com;

    ssl_certificate /etc/letsencrypt/live/tudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tudominio.com/privkey.pem;

    # API Backend
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Frontend
    location / {
        root /var/www/botzilla/frontend;
        try_files $uri $uri/ /index.html;
        
        # Headers de seguridad
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "no-referrer-when-downgrade" always;
    }

    # Configuración de seguridad
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
}
```

### **Configurar PM2 manualmente:**

```bash
cd backend
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 📊 COMANDOS ÚTILES

### **Gestión de la aplicación:**
```bash
pm2 status                    # Ver estado
pm2 logs botzilla-api        # Ver logs
pm2 restart botzilla-api     # Reiniciar
pm2 stop botzilla-api        # Detener
pm2 delete botzilla-api      # Eliminar
```

### **Gestión de base de datos:**
```bash
# Conectar a PostgreSQL
sudo -u postgres psql

# Ver bases de datos
\l

# Conectar a botzilla_prod
\c botzilla_prod

# Ver tablas
\dt botzilla.*
```

### **Logs del sistema:**
```bash
# Logs de Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Logs de PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-*.log

# Logs de PM2
pm2 logs
```

---

## 🔒 SEGURIDAD IMPLEMENTADA

### **✅ Medidas de seguridad activas:**
- **Base de datos local** (127.0.0.1) - No accesible desde internet
- **Rate limiting** - Protección contra ataques de fuerza bruta
- **CORS configurado** - Solo dominios permitidos
- **Helmet** - Headers de seguridad
- **HTTPS/SSL** - Comunicación encriptada
- **Firewall** - Solo puertos necesarios abiertos
- **Validación de entrada** - Sanitización de datos
- **JWT seguro** - Autenticación robusta

### **🔧 Configuraciones de seguridad:**
- **PostgreSQL:** Solo acceso local
- **Nginx:** Headers de seguridad
- **PM2:** Gestión de procesos segura
- **Logs:** Sin información sensible en producción

---

## 🚨 SOLUCIÓN DE PROBLEMAS

### **Error de conexión a base de datos:**
```bash
# Verificar que PostgreSQL esté corriendo
sudo systemctl status postgresql

# Verificar configuración
sudo nano /etc/postgresql/*/main/pg_hba.conf

# Reiniciar PostgreSQL
sudo systemctl restart postgresql
```

### **Error de permisos Nginx:**
```bash
# Verificar permisos
sudo chown -R www-data:www-data /var/www/botzilla
sudo chmod -R 755 /var/www/botzilla

# Verificar configuración
sudo nginx -t
sudo systemctl reload nginx
```

### **Error de certificado SSL:**
```bash
# Renovar certificado
sudo certbot renew

# Verificar certificado
sudo certbot certificates
```

### **Aplicación no responde:**
```bash
# Verificar PM2
pm2 status
pm2 logs botzilla-api

# Verificar puerto
sudo netstat -tlnp | grep :3000

# Reiniciar aplicación
pm2 restart botzilla-api
```

---

## 📞 SOPORTE

Si tienes problemas durante el despliegue:

1. **Revisar logs:** `pm2 logs botzilla-api`
2. **Verificar estado:** `pm2 status`
3. **Revisar configuración:** Verificar archivos .env y nginx
4. **Documentación:** Revisar logs de error específicos

---

## 🎉 ¡LISTO!

Tu aplicación BotZilla API V2 estará disponible en:
- **Frontend:** https://tudominio.com
- **API:** https://tudominio.com/api
- **Health Check:** https://tudominio.com/api/health

**¡Disfruta de tu aplicación desplegada de forma segura!** 🚀
