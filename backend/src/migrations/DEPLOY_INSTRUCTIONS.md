# 🚀 Instrucciones de Deploy - Sistema Follow-Up + SMS Batches

## 📋 Resumen

Este documento contiene las instrucciones completas para hacer deploy del sistema de Follow-Up, SMS Batches y Chat en tiempo real.

**Fecha**: Diciembre 2025  
**Versión**: 1.0

---

## ✅ Checklist Pre-Deploy

### 1. Base de Datos

- [ ] **Ejecutar migración SQL completa**
  ```bash
  psql -h [HOST] -U [USER] -d [DATABASE] -f backend/src/migrations/DEPLOY_MIGRATION_FOLLOW_UP_SMS_COMPLETE.sql
  ```
  
  O desde psql:
  ```sql
  \i backend/src/migrations/DEPLOY_MIGRATION_FOLLOW_UP_SMS_COMPLETE.sql
  ```

- [ ] **Verificar que las tablas se crearon correctamente**
  ```sql
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema = 'botzilla' 
  AND table_name IN (
    'follow_up_status', 'follow_up_label', 'chat', 'chat_message', 
    'follow_up_ticket', 'sms_batch', 'sms_batch_estimate', 'sms_webhook_config'
  );
  ```
  
  Debe retornar 8 filas.

- [ ] **Verificar que los statuses se insertaron**
  ```sql
  SELECT name, description, color 
  FROM botzilla.follow_up_status 
  WHERE name IN ('Pending FU', 'Texted', 'Lost', 'Sold', 'Negotiating')
  ORDER BY name;
  ```

### 2. Variables de Entorno

- [ ] **Agregar `QUO_SMS_WEBHOOK_URL` al `.env` del backend**
  ```env
  QUO_SMS_WEBHOOK_URL=https://hook.eu1.make.com/your-webhook-url
  ```
  
  ⚠️ **IMPORTANTE**: Reemplazar con la URL real del webhook de Make.com/QUO.

### 3. Configuración de Nginx (Producción)

- [ ] **Verificar que Nginx tenga la configuración de WebSocket**
  
  El archivo `nginx-config.conf` ya incluye:
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

- [ ] **Recargar Nginx después de cambios**
  ```bash
  sudo nginx -t  # Verificar configuración
  sudo systemctl reload nginx
  ```

### 4. Backend

- [ ] **Verificar que el puerto del backend sea correcto**
  - Desarrollo: `3333`
  - Producción: `3000` (o el que corresponda)

- [ ] **Instalar dependencias (si es necesario)**
  ```bash
  cd backend
  npm install
  ```

- [ ] **Verificar que Socket.io esté instalado**
  ```bash
  npm list socket.io
  ```

- [ ] **Reiniciar el backend**
  ```bash
  # PM2 (si usas PM2)
  pm2 restart botzilla-api
  
  # O manualmente
  npm start
  ```

### 5. Frontend

- [ ] **Verificar que el proxy de Vite esté configurado** (solo desarrollo)
  - El archivo `frontend/vite.config.ts` ya tiene la configuración correcta

- [ ] **Build del frontend para producción**
  ```bash
  cd frontend
  npm run build
  ```

- [ ] **Verificar que el build se completó sin errores**

---

## 📝 Tablas Creadas

La migración crea las siguientes tablas:

1. **`follow_up_status`** - Estados de follow-up (Lost, Sold, Negotiating, Pending FU, Texted)
2. **`follow_up_label`** - Etiquetas de follow-up (PMP, Discount, Other)
3. **`chat`** - Contenedor de conversaciones
4. **`chat_message`** - Mensajes individuales (con campo `read_at` para mensajes no leídos)
5. **`follow_up_ticket`** - Tickets de follow-up vinculados a estimates
6. **`sms_batch`** - Grupos de estimates para envío masivo
7. **`sms_batch_estimate`** - Relación many-to-many entre batches y estimates
8. **`sms_webhook_config`** - Configuración de webhooks (opcional)

---

## 🔄 Actualizaciones de Datos

La migración también:

- ✅ Inserta los nuevos statuses: "Pending FU" y "Texted"
- ✅ Actualiza tickets existentes de "Negotiating" a "Pending FU"
- ✅ Crea índices para optimizar consultas
- ✅ Crea triggers para mantener `total_estimates` actualizado en batches

---

## 🧪 Testing Post-Deploy

### 1. Verificar Chat en Tiempo Real

1. Abrir un estimate "Lost" en `/follow-up/estimates`
2. Hacer clic en "Actions" → "Follow Up"
3. Enviar un mensaje en el chat
4. Verificar que el mensaje aparece inmediatamente (sin refresh)

### 2. Verificar Inbox

1. Ir a `/follow-up/inbox`
2. Verificar que aparecen los chats con historial
3. Verificar que los chats no leídos aparecen primero
4. Abrir un chat y verificar que los mensajes se marcan como leídos

### 3. Verificar SMS Batches

1. Ir a `/follow-up/sms-batches`
2. Crear un nuevo batch
3. Agregar estimates al batch
4. Componer un mensaje SMS con variables dinámicas
5. Enviar el batch y verificar que llega a Make.com/QUO

### 4. Verificar Webhook de SMS Entrantes

1. Enviar un SMS de prueba desde QUO/Make.com al endpoint:
   ```
   POST /api/follow-up-tickets/webhook/incoming-sms
   ```
2. Verificar que el mensaje aparece en el chat correspondiente

---

## 🐛 Troubleshooting

### Error: "Table already exists"

Si alguna tabla ya existe, la migración usa `CREATE TABLE IF NOT EXISTS`, así que es seguro ejecutarla de nuevo.

### Error: "WebSocket connection failed"

1. Verificar que Nginx tenga la configuración de `/socket.io/`
2. Verificar que el backend esté corriendo
3. Verificar que no haya firewall bloqueando WebSockets
4. Revisar logs del backend para errores de Socket.io

### Error: "QUO_SMS_WEBHOOK_URL not configured"

1. Verificar que la variable esté en el `.env` del backend
2. Reiniciar el backend después de agregar la variable
3. Verificar que la URL del webhook sea correcta

### Los mensajes no aparecen en tiempo real

1. Verificar que Socket.io esté corriendo (revisar logs del backend)
2. Verificar que el frontend esté conectado (revisar consola del navegador)
3. Verificar que el cliente se haya unido al room del chat (`join-chat`)

---

## 📞 Soporte

Si encuentras problemas durante el deploy:

1. Revisar los logs del backend: `pm2 logs botzilla-api` o `npm run dev`
2. Revisar la consola del navegador para errores del frontend
3. Verificar que todas las tablas se crearon correctamente en la base de datos
4. Verificar que las variables de entorno estén configuradas

---

## ✅ Post-Deploy

Después de hacer deploy exitosamente:

- [ ] Notificar al equipo que el sistema está disponible
- [ ] Documentar cualquier cambio adicional necesario
- [ ] Monitorear logs durante las primeras horas
- [ ] Verificar que los usuarios puedan acceder a las nuevas funcionalidades

---

**¡Deploy exitoso! 🎉**

