# BotZilla API v2 - Setup de Estimates desde Attic Tech

## 🔧 Configuración Necesaria

### 1. Variables de Entorno
Crea un archivo `.env` en la carpeta `/backend/` con las siguientes variables:

```env
# Configuración de la base de datos
DB_HOST=localhost
DB_PORT=5432
DB_NAME=botzilla
DB_USER=postgres
DB_PASSWORD=tu_password_aqui
DB_SSL=false

# Configuración JWT
JWT_SECRET=tu_clave_secreta_jwt_aqui
JWT_EXPIRES_IN=24h

# Configuración del servidor
PORT=3000
NODE_ENV=development

# ⚠️ IMPORTANTE: Credenciales de Attic Tech API
ATTIC_TECH_EMAIL=tu_email@domain.com
ATTIC_TECH_PASSWORD=tu_password_attic_tech
```

### 2. Endpoints Disponibles

#### **POST** `/api/sync-estimates`
Sincroniza estimates desde Attic Tech a la base de datos local.

**Headers:**
```
Authorization: Bearer <tu_jwt_token>
Content-Type: application/json
```

**Body (opcional):**
```json
{
  "fechaInicio": "2024-01-01",
  "fechaFin": "2024-12-31"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Estimates synchronized successfully",
  "stats": {
    "inserted": 15,
    "updated": 3,
    "salesPersons": 5,
    "branches": 3,
    "statuses": 4,
    "errors": []
  },
  "logs": [
    "🔑 Starting dynamic API login to Attic Tech...",
    "✅ Successfully logged in to Attic Tech",
    "📊 Starting to fetch estimates from 2024-01-01 to 2024-12-31",
    "📄 Fetched page 1: 50 estimates",
    "✅ Total estimates fetched: 123",
    "🔄 Processing 123 estimates...",
    "✅ Synchronization completed successfully"
  ]
}
```

#### **POST** `/api/fetch-estimates`
Obtiene estimates de la base de datos local con filtros y paginación.

**Headers:**
```
Authorization: Bearer <tu_jwt_token>
Content-Type: application/json
```

**Body (opcional):**
```json
{
  "page": 1,
  "limit": 50,
  "branch": "Miami",
  "salesperson": "John Doe",
  "status": "active",
  "fromDate": "2024-01-01",
  "toDate": "2024-12-31"
}
```

**Respuesta:**
```json
{
  "estimates": [
    {
      "id": 1,
      "name": "Smith House - Roof Repair",
      "created_date": "2024-01-15T10:30:00.000Z",
      "price": "5500.00",
      "discount": "200.00",
      "attic_tech_hours": 24,
      "salesperson": {
        "id": 1,
        "name": "John Perez",
        "phone": "+1-305-555-0101",
        "telegram_id": "@johnperez"
      },
      "branch": {
        "id": 1,
        "name": "Miami",
        "address": "1234 SW 8th St, Miami, FL 33135"
      },
      "status": {
        "id": 1,
        "name": "active"
      }
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 123,
    "itemsPerPage": 50
  }
}
```

## 🚀 Cómo Usar

### 1. Primero sincroniza los datos:
```bash
curl -X POST http://localhost:3000/api/sync-estimates \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fechaInicio": "2024-01-01"}'
```

### 2. Luego consulta los estimates:
```bash
curl -X POST http://localhost:3000/api/fetch-estimates \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"page": 1, "limit": 10}'
```

## 📊 Funcionalidad Implementada

✅ **Login automático** a Attic Tech con credenciales del .env  
✅ **Fetch con paginación** desde `/api/job-estimates`  
✅ **Mapeo automático** de datos a la nueva estructura de BD  
✅ **Creación automática** de SalesPersons, Branches y Statuses  
✅ **Relaciones automáticas** entre SalesPersons y Branches  
✅ **Detección de duplicados** por nombre y fecha  
✅ **Logs detallados** de todo el proceso  
✅ **Manejo de errores** robusto  

## 🔄 Flujo de Sincronización

1. **Login** → Obtiene token de Attic Tech
2. **Fetch** → Descarga estimates con paginación  
3. **Mapeo** → Convierte datos al formato de nuestra BD
4. **Procesamiento** → Para cada estimate:
   - Encuentra o crea SalesPerson
   - Encuentra o crea Branch  
   - Encuentra o crea EstimateStatus
   - Crea relación SalesPerson-Branch si no existe
   - Inserta o actualiza Estimate
5. **Respuesta** → Retorna estadísticas y logs

¡Listo para usar! 🎉 