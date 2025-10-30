# Bulk Overrun Reports - Make.com Integration

## 📋 Overview

Esta funcionalidad permite enviar múltiples jobs a Make.com para generar reportes de overrun en batch, en lugar de tener que generar cada reporte individualmente.

## 🔧 Setup

### 1. Variable de Entorno

La funcionalidad usa la variable de entorno existente en el archivo `.env` del backend:

```env
MAKE_OVERRUN_ALERT_WEBHOOK_URL=https://hook.us1.make.com/YOUR_WEBHOOK_ID
```

### 2. Make.com Workflow

El workflow de Make.com debe tener la siguiente estructura:

```
Webhook → Iterator → Google Sheets → Router → (Telegram Bot + Data Store + Tools) → HTTP Response
```

**Detalles del Webhook:**
- **Input esperado**: Un array de jobs
- **Formato del payload**:
```json
{
  "jobs": [
    {
      "job_id": 924,
      "branch": "Everett - WA",
      "job_name": "Example Job",
      "sales_person": "Jane Smith",
      "crew_leader": "John Doe",
      "closing_date": "10/28/2025",
      "at_estimated_hours": 39.13,
      "total_hours_worked": 85.44,
      "hours_saved": -46.31
    },
    ...
  ]
}
```

**Notas sobre los campos:**
- `job_id`: ID interno del job en BotZilla
- `closing_date`: Formato MM/DD/YYYY (ejemplo: "10/28/2025")
- Campos de texto vacíos: string vacío `""`
- Campos numéricos sin valor: `0`
- Todos los números tienen 2 decimales máximo

**Iterator Configuration:**
- El Iterator debe procesar el array `jobs`
- Cada elemento del array se pasa individualmente a los siguientes módulos
- Los módulos subsecuentes (Google Sheets, Telegram Bot, etc.) procesan cada job

## 🎯 Uso en el Frontend

### Jobs Analysis → Overrun Jobs / Operation Command

1. **Filtrar jobs sin reporte**: Activar el checkbox "Show only jobs without report/post"
2. **Seleccionar jobs**: 
   - Usar los checkboxes individuales para seleccionar jobs específicos
   - O usar el checkbox del header para seleccionar todos
3. **Enviar a Make.com**: Click en el botón "Send X to Make.com"
4. **Confirmación**: Confirmar el envío en el modal
5. **Resultado**: Los jobs se envían a Make.com y el iterator genera los reportes

### Diferencias por Tab

**Overrun Jobs Tab:**
- Filtro: Muestra jobs con `% Actual Saved < 0%`
- Checkbox: "Show only jobs without report"
- Envía jobs para generar **overrun reports**

**Operation Command Tab:**
- Filtro: Muestra jobs con `% Actual Saved > 15%`
- Checkbox: "Show only jobs without post"
- Envía jobs para generar **operation command posts**

## 📡 API Endpoint

### POST `/api/overrun-reports/send-bulk-to-make`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "jobs": [
    {
      "job_id": 924,
      "branch": "Everett - WA",
      "job_name": "Example Job",
      "sales_person": "Jane Smith",
      "crew_leader": "John Doe",
      "closing_date": "10/28/2025",
      "at_estimated_hours": 39.13,
      "total_hours_worked": 85.44,
      "hours_saved": -46.31
    }
  ]
}
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Successfully sent 5 job(s) to Make.com",
  "data": {
    "jobs_sent": 5,
    "webhook_response_status": 200
  }
}
```

**Response Error (400/500):**
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error information"
}
```

## 🔍 Logs

Los logs del proceso se guardan en:
- Backend: `backend/logs/combined-YYYY-MM-DD.log`
- Make.com: Execution history en el scenario

**Ejemplo de log:**
```
[INFO] Sending bulk jobs to Make.com { jobs_count: 5, job_ids: [123, 124, 125, 126, 127] }
[INFO] Successfully sent jobs to Make.com { jobs_count: 5, response_status: 200 }
```

## ⚠️ Consideraciones

1. **Límites**: No hay límite en el número de jobs que se pueden enviar, pero se recomienda no exceder 50 jobs por envío para evitar timeouts
2. **Timeout**: El request tiene un timeout de 30 segundos
3. **Rate Limiting**: El endpoint está protegido por el rate limiter general (100 requests por 15 minutos)
4. **Autenticación**: Requiere token JWT válido

## 🐛 Troubleshooting

### Error: "Make.com webhook URL not configured"
- **Solución**: Verificar que la variable `MAKE_OVERRUN_ALERT_WEBHOOK_URL` esté definida en el `.env`

### Error: "Failed to send jobs to Make.com"
- **Posibles causas**:
  - URL del webhook incorrecta
  - Make.com scenario desactivado
  - Problemas de red
- **Solución**: Verificar logs del backend y la ejecución en Make.com

### Los reportes no se generan
- **Posibles causas**:
  - Error en el Iterator de Make.com
  - Configuración incorrecta del workflow
- **Solución**: Verificar la execution history en Make.com para ver qué módulo está fallando

## 📚 Archivos Relacionados

### Backend
- `backend/src/controllers/overrunReport.controller.js` - Controlador principal
- `backend/src/routes/overrunReport.routes.js` - Rutas del API
- `backend/src/app.js` - Registro de rutas

### Frontend
- `frontend/src/pages/OverrunJobs.tsx` - Página principal con selección múltiple

