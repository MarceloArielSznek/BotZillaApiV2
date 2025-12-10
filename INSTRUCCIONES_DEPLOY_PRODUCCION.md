# 🚀 Instrucciones de Deploy a Producción - Sistema Follow-Up/SMS

**Fecha**: Diciembre 2025  
**Versión**: 1.0  
**Commit**: `c3459c9`

---

## 📋 Resumen

Este deploy agrega:
- Sistema de Follow-Up mejorado
- Sistema de SMS Batches para envío masivo
- Chat en tiempo real con WebSockets
- Inbox de mensajes
- Integración con Attic Tech

**IMPORTANTE**: Este deploy requiere actualizar la base de datos con nuevas tablas.

---

## ⚠️ ANTES DE COMENZAR

1. **Backup de la base de datos** (OBLIGATORIO):
   ```bash
   pg_dump -h [HOST] -U [USER] -d [DATABASE] -F c -f backup_antes_followup_$(date +%Y%m%d_%H%M%S).dump
   ```

2. **Verificar que el servidor esté accesible**
3. **Tener acceso SSH al servidor**
4. **Tener acceso a la base de datos PostgreSQL**

---

## 📦 PASO 1: Actualizar el Código (Git Pull)

### 1.1 Conectarse al servidor
```bash
ssh usuario@servidor-produccion
```

### 1.2 Ir al directorio del proyecto
```bash
cd /ruta/al/proyecto/BotZillaApiV2
```

### 1.3 Verificar el estado actual
```bash
git status
git log --oneline -5  # Ver últimos commits
```

### 1.4 Hacer pull del código actualizado
```bash
git pull origin master
```

### 1.5 Verificar que el pull fue exitoso
```bash
git log --oneline -1  # Debe mostrar commit c3459c9
ls -la backend/src/migrations/DEPLOY_MIGRATION_FOLLOW_UP_SMS_COMPLETE.sql  # Verificar que existe
```

---

## 🗄️ PASO 2: Actualizar la Base de Datos

### 2.1 Verificar conexión a la base de datos
```bash
psql -h [HOST] -U [USER] -d [DATABASE] -c "SELECT version();"
```

**Reemplazar:**
- `[HOST]`: IP o hostname del servidor PostgreSQL
- `[USER]`: Usuario de PostgreSQL (ej: `postgres`)
- `[DATABASE]`: Nombre de la base de datos (ej: `postgres`)

### 2.2 Ejecutar la migración SQL

**Opción A: Desde psql (Recomendado)**
```bash
psql -h [HOST] -U [USER] -d [DATABASE] -f backend/src/migrations/DEPLOY_MIGRATION_FOLLOW_UP_SMS_COMPLETE.sql
```

**Opción B: Desde psql interactivo**
```bash
psql -h [HOST] -U [USER] -d [DATABASE]
```
Luego dentro de psql:
```sql
\i backend/src/migrations/DEPLOY_MIGRATION_FOLLOW_UP_SMS_COMPLETE.sql
```

### 2.3 Verificar que las tablas se crearon correctamente

```sql
-- Ejecutar en psql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'botzilla' 
AND table_name IN (
    'follow_up_status', 
    'follow_up_label', 
    'chat', 
    'chat_message', 
    'follow_up_ticket', 
    'sms_batch', 
    'sms_batch_estimate', 
    'sms_webhook_config'
)
ORDER BY table_name;
```

**Resultado esperado**: Debe mostrar 8 filas (una por cada tabla).

### 2.4 Verificar que los statuses se insertaron

```sql
SELECT name, description, color 
FROM botzilla.follow_up_status 
WHERE name IN ('Pending FU', 'Texted', 'Lost', 'Sold', 'Negotiating')
ORDER BY name;
```

**Resultado esperado**: Debe mostrar 5 filas.

---

## ⚙️ PASO 3: Configurar Variables de Entorno

### 3.1 Agregar variable de webhook SMS

Editar el archivo `.env` del backend:
```bash
nano backend/.env
# o
vi backend/.env
```

### 3.2 Agregar la siguiente línea:
```env
QUO_SMS_WEBHOOK_URL=https://hook.eu1.make.com/tu-webhook-url-aqui
```

**⚠️ IMPORTANTE**: Reemplazar `tu-webhook-url-aqui` con la URL real del webhook de Make.com/QUO.

### 3.3 Guardar y salir
- En nano: `Ctrl+X`, luego `Y`, luego `Enter`
- En vi: `Esc`, luego `:wq`, luego `Enter`

---

## 🔄 PASO 4: Reiniciar el Backend

### 4.1 Si usas PM2:
```bash
pm2 restart botzilla-api
# o
pm2 restart all
```

### 4.2 Verificar que el backend está corriendo:
```bash
pm2 status
pm2 logs botzilla-api --lines 50  # Ver últimos logs
```

### 4.3 Si NO usas PM2:
```bash
# Detener el proceso actual (Ctrl+C o kill)
# Luego iniciar de nuevo
cd backend
npm start
# o
node src/server.js
```

---

## 🌐 PASO 5: Verificar Configuración de Nginx (WebSockets)

### 5.1 Verificar que Nginx tiene la configuración de WebSocket

```bash
sudo nginx -t  # Verificar sintaxis
cat /etc/nginx/sites-available/botzilla | grep -A 10 "socket.io"
```

### 5.2 Si falta la configuración, agregar:

```nginx
location /socket.io/ {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 86400;
    proxy_send_timeout 86400;
}
```

### 5.3 Recargar Nginx:
```bash
sudo nginx -t  # Verificar antes de recargar
sudo systemctl reload nginx
```

---

## ✅ PASO 6: Verificación Post-Deploy

### 6.1 Verificar que el backend responde:
```bash
curl http://localhost:3000/health
# o
curl http://localhost:3000/api/health
```

### 6.2 Verificar logs del backend:
```bash
pm2 logs botzilla-api --lines 100
# Buscar errores relacionados con:
# - Socket.io
# - Base de datos
# - Webhooks
```

### 6.3 Verificar en el navegador:
1. Acceder a la aplicación
2. Ir a `/follow-up/estimates` - Debe cargar sin errores
3. Ir a `/follow-up/inbox` - Debe mostrar la lista de chats
4. Ir a `/follow-up/sms-batches` - Debe mostrar la lista de batches

---

## 🐛 Troubleshooting

### Error: "Table already exists"
**Solución**: Es normal, la migración usa `CREATE TABLE IF NOT EXISTS`. Continuar.

### Error: "Permission denied" al ejecutar psql
**Solución**: Verificar que el usuario tiene permisos. Intentar con `sudo -u postgres psql`.

### Error: "Connection refused" en WebSocket
**Solución**: 
1. Verificar que Nginx tiene la configuración de `/socket.io/`
2. Verificar que el backend está corriendo en el puerto correcto
3. Revisar logs de Nginx: `sudo tail -f /var/log/nginx/error.log`

### Error: "QUO_SMS_WEBHOOK_URL not configured"
**Solución**: Verificar que la variable está en el `.env` y reiniciar el backend.

### Los mensajes no aparecen en tiempo real
**Solución**:
1. Verificar que Socket.io está corriendo (revisar logs)
2. Verificar que el frontend puede conectarse (revisar consola del navegador)
3. Verificar que Nginx está proxyando `/socket.io/` correctamente

---

## 📞 Contacto

Si encuentras problemas durante el deploy:
1. Revisar los logs del backend: `pm2 logs botzilla-api`
2. Revisar los logs de Nginx: `sudo tail -f /var/log/nginx/error.log`
3. Verificar que todas las tablas se crearon: ejecutar la query del paso 2.3
4. Contactar al equipo de desarrollo con los logs de error

---

## ✅ Checklist Final

- [ ] Backup de base de datos realizado
- [ ] Código actualizado (`git pull`)
- [ ] Migración SQL ejecutada exitosamente
- [ ] 8 tablas creadas y verificadas
- [ ] 5 statuses insertados y verificados
- [ ] Variable `QUO_SMS_WEBHOOK_URL` configurada en `.env`
- [ ] Backend reiniciado
- [ ] Nginx configurado para WebSockets
- [ ] Backend responde correctamente
- [ ] Frontend carga sin errores
- [ ] Chat en tiempo real funciona
- [ ] Inbox muestra los chats

---

**¡Deploy completado! 🎉**

