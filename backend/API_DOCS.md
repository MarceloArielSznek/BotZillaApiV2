# BotZilla API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication

### Login
User login and obtain a JWT token.

```http
POST /auth/login
```

**Body**
```json
{
    "email": "user@example.com",
    "password": "password123"
}
```

**Success Response (200)**
```json
{
    "id": 1,
    "email": "user@example.com",
    "role": "admin",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors**
- 404: User not found
- 401: Invalid password
- 500: Server error

### Register
Register a new user in the system.

```http
POST /auth/register
```

**Body**
```json
{
    "email": "nuevo@ejemplo.com",
    "password": "contraseña123",
    "phone": "+1234567890",     // Opcional
    "telegram_id": "user123"    // Opcional
}
```

**Validaciones**
- Email debe ser válido
- Contraseña: mínimo 6 caracteres y al menos un número
- Teléfono: formato válido (opcional)

**Respuesta Exitosa (201)**
```json
{
    "id": 2,
    "email": "nuevo@ejemplo.com",
    "role": "user",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errores**
- 400: Email ya registrado o datos inválidos
- 500: Error del servidor

### Logout
Cierra la sesión del usuario (requiere autenticación).

```http
POST /auth/logout
```

**Headers**
```
Authorization: Bearer <token>
```

**Respuesta Exitosa (200)**
```json
{
    "message": "Sesión cerrada exitosamente"
}
```

**Errores**
- 401: Token inválido o no proporcionado

### Verificar Token
Verifica si el token es válido y devuelve información del usuario.

```http
GET /auth/verify
```

**Headers**
```
Authorization: Bearer <token>
```

**Respuesta Exitosa (200)**
```json
{
    "id": 1,
    "email": "usuario@ejemplo.com",
    "role": "admin"
}
```

**Errores**
- 401: Token inválido o no proporcionado

## Uso del Token

Para las rutas protegidas, incluir el token en el header de la siguiente manera:

```http
Authorization: Bearer <tu_token_jwt>
```

## Roles de Usuario

El sistema maneja los siguientes roles:
- `admin`: Acceso completo al sistema
- `user`: Usuario regular con acceso limitado
- `client`: Cliente con acceso básico

## Códigos de Estado

- 200: Operación exitosa
- 201: Recurso creado exitosamente
- 400: Error en la solicitud (datos inválidos)
- 401: No autorizado (token inválido o expirado)
- 403: Prohibido (no tiene permisos suficientes)
- 404: Recurso no encontrado
- 500: Error interno del servidor

## Gestión de Usuarios

### Listar Usuarios
Obtiene la lista de todos los usuarios (requiere rol de admin).

```http
GET /users
```

**Headers**
```
Authorization: Bearer <token>
```

**Respuesta Exitosa (200)**
```json
[
    {
        "id": 1,
        "email": "admin@botzilla.com",
        "phone": "+1234567890",
        "telegram_id": "admin123",
        "rol": {
            "id": 1,
            "name": "admin"
        }
    },
    // ... más usuarios
]
```

**Errores**
- 401: No autorizado
- 403: No tiene permisos de administrador

### Obtener Usuario por ID
Obtiene los detalles de un usuario específico (requiere ser el mismo usuario o admin).

```http
GET /users/:id
```

**Headers**
```
Authorization: Bearer <token>
```

**Respuesta Exitosa (200)**
```json
{
    "id": 1,
    "email": "usuario@ejemplo.com",
    "phone": "+1234567890",
    "telegram_id": "user123",
    "rol": {
        "id": 2,
        "name": "user"
    }
}
```

**Errores**
- 401: No autorizado
- 403: No tiene permisos para ver este usuario
- 404: Usuario no encontrado

### Actualizar Usuario
Actualiza los datos de un usuario (requiere ser el mismo usuario o admin).

```http
PUT /users/:id
```

**Headers**
```
Authorization: Bearer <token>
```

**Body**
```json
{
    "email": "nuevo@ejemplo.com",    // Opcional
    "phone": "+1234567890",         // Opcional
    "telegram_id": "newuser123"     // Opcional
}
```

**Validaciones**
- Email debe ser válido
- Teléfono debe tener formato válido
- No se puede usar un email que ya existe

**Respuesta Exitosa (200)**
```json
{
    "message": "Usuario actualizado exitosamente",
    "user": {
        "id": 1,
        "email": "nuevo@ejemplo.com",
        "phone": "+1234567890",
        "telegram_id": "newuser123"
    }
}
```

**Errores**
- 400: Datos inválidos o email ya en uso
- 401: No autorizado
- 403: No tiene permisos para actualizar este usuario
- 404: Usuario no encontrado

### Cambiar Contraseña
Cambia la contraseña de un usuario (solo el propio usuario puede cambiar su contraseña).

```http
PUT /users/:id/password
```

**Headers**
```
Authorization: Bearer <token>
```

**Body**
```json
{
    "currentPassword": "contraseña123",
    "newPassword": "nuevaContraseña123"
}
```

**Validaciones**
- La contraseña actual es requerida
- La nueva contraseña debe tener al menos 6 caracteres
- La nueva contraseña debe contener al menos un número

**Respuesta Exitosa (200)**
```json
{
    "message": "Contraseña actualizada exitosamente"
}
```

**Errores**
- 400: Datos inválidos
- 401: Contraseña actual incorrecta
- 403: No tiene permisos para cambiar esta contraseña
- 404: Usuario no encontrado

### Eliminar Usuario
Elimina un usuario del sistema (requiere rol de admin).

```http
DELETE /users/:id
```

**Headers**
```
Authorization: Bearer <token>
```

**Respuesta Exitosa (200)**
```json
{
    "message": "Usuario eliminado exitosamente"
}
```

**Errores**
- 401: No autorizado
- 403: No tiene permisos de administrador
- 404: Usuario no encontrado

---

## Notifications

Endpoints designed to generate structured notification payloads. These are intended to be consumed by an external automation service like Make.com, which will then handle the actual delivery of the messages (e.g., via Telegram).

### POST /notifications/salesperson-warnings

Generates warning and congratulatory notifications for salespersons based on their active lead count.

This endpoint analyzes all salespersons and:
- Issues a warning if they have 12 or more active leads ('In Progress' or 'Released').
- Generates a congratulatory message if they drop below the threshold after having been warned.

The response is a JSON array of notification objects, ready to be processed and sent by a service like Make.com. A `dryRun` query parameter can be used to test the logic without altering database records.

-   **Security**: Requires `X-API-Key` in the header.
-   **Query Parameters**:
    -   `dryRun` (boolean, optional): If `true`, runs the logic without saving to the database.
-   **Success Response (`200 OK`)**: Returns a JSON array of notification objects.
-   **Error Responses**:
    -   `401 Unauthorized`: API key is missing.
    -   `403 Forbidden`: API key is invalid.

---

### POST /notifications/manager-warnings

Generates a consolidated list of notifications for Branch Managers and a daily summary for Admins. This single endpoint provides all necessary daily warning notifications.

**For Managers:**
- It identifies all salespeople exceeding their active lead limit (12).
- Groups them by their respective branches.
- Compiles a single, formatted notification for each Branch Manager, listing only the salespeople from their branch. A manager is identified by the `manager` role and their association with a branch in the `user_branch` table.

**For Admins:**
- It generates a daily summary notification.
- This summary is sent to every user with the `admin` role who has a configured Telegram ID.

The response is a single JSON array containing all notification objects (for both managers and admins), ready for an external service like Make.com to process and deliver.

-   **Security**: Requires `X-API-Key` in the header.
-   **Success Response (`200 OK`)**: Returns a JSON array of notification objects. Each object contains `recipient_telegram_id` and `message_text`.
-   **Error Responses**:
    -   `401 Unauthorized`: API key is missing.
    -   `403 Forbidden`: API key is invalid.
    -   `500 Internal Server Error`: An error occurred on the server.


## Automations

Endpoints designed to trigger server automations, primarily for use with services like Make.com.

### Trigger External Estimate Sync
Manually triggers the synchronization of estimates from the external source (e.g., Attic Tech). This is useful for forcing an update without waiting for the next scheduled sync.

```http
POST /automations/estimates/sync-external
```

**Headers**
```
Authorization: Bearer <admin_token>
```

**Body**
(No body required)

**Success Response (200)**
```json
{
    "message": "External estimates synchronization finished.",
    "newEstimatesCount": 5,
    "updatedEstimatesCount": 2
}
```

**Errors**
- 401: Unauthorized (token is missing or invalid).
- 403: Forbidden (user is not an administrator).
- 500: Internal server error during the synchronization process.

### Sync Column Map
Receives the header row of a spreadsheet and syncs it with the `sheet_column_map` table.

- **Endpoint**: `POST /api/automations/column-map/sync`
- **Authentication**: Requires `X-API-Key` in the header.
- **Query Parameters**:
  - `dryRun` (boolean, optional): If `true`, the sync is simulated and no data is saved.
- **Body**:
  The endpoint accepts two formats.

  **Formato 1: Objeto Directo (Preferido para Make.com)**
  ```json
  {
      "name": "San Bernardino",
      "columns": {
          "0": "Date",
          "1": "Client Name",
          "2": "John Doe"
      }
  }
  ```

  **Formato 2: Array (Legado/Manual)**
  ```json
  {
      "sheet_name": "San Bernardino",
      "header_row": ["Date", "Client Name", "John Doe"]
  }
  ```
- **Logic**:
  - The API will automatically extract the values from the `columns` object.
  - The `type` is determined as `"crew_member"` if the column name contains a space, otherwise it's `"field"`.
  - Empty strings and internal Make.com fields (like `__ROW_NUMBER__`) are ignored.
- **Success Response (200)**:
  ```json
  {
      "success": true,
      "message": "Successfully synced 3 columns for sheet \"San Bernardino\".",
      "syncedRecords": 3
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: If the body is malformed or required fields are missing.
  - `401 Unauthorized`: If the API key is missing or invalid.
  - `500 Internal Server Error`: For any other processing error.

### Process Spreadsheet Row
Receives a single row of data from a spreadsheet and uses the previously synced column map to transform it into a structured JSON object. This is the first step before persisting the data into specific tables like `Job` or `Shift`.

- **Endpoint**: `POST /api/automations/process-row`
- **Authentication**: Requires `X-API-Key` in the header.
- **Query Parameters**:
  - `dryRun` (boolean, optional): If `true`, the row is processed and returned, but no database operations (like saving a Job or Shift) are performed.
- **Body**:
  ```json
  {
      "sheet_name": "Testing",
      "row_number": 3,
      "row_data": ["Value for Col A", "Value for Col B", "Value for Col C"]
  }
  ```
  *Note: `row_data` can also be a single comma-separated string, e.g., `"Value for Col A,Value for Col B,Value for Col C"`.*

- **Success Response (200)**:
  Returns the row data transformed into a key-value object based on the column map.
  ```json
  {
      "success": true,
      "message": "Row 3 from sheet \"Testing\" is ready for processing.",
      "processedData": {
          "Job Data": "Value for Col A",
          "Job Name": "Value for Col B",
          "ADMIN": "Value for Col C"
      }
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: If required fields are missing in the body.
  - `404 Not Found`: If no column map has been synced for the given `sheet_name`.
  - `500 Internal Server Error`: For any other processing error.

## Notifications

Endpoints designed to be consumed by external notification services like Make.com. These endpoints generate structured JSON payloads that the external service can use to send notifications to the appropriate users (e.g., via Telegram). Access is restricted to administrators.

### Generate Estimate Notifications
Generates a list of notifications related to new or updated estimates. The server determines *what* to send and *to whom*, while the external service handles the delivery.

```http
POST /notifications/estimates
```

**Headers**
```
Authorization: Bearer <admin_token>
```

**Body**
(No body required, but could be extended in the future to accept filters, e.g., a date range)
```json
{}
```

**Success Response (200)**
This response provides a list of ready-to-send notifications. The external service can iterate through this list and dispatch each message.
```json
{
    "message": "Estimate notifications generated successfully.",
    "notifications": [
        {
            "recipient_telegram_id": "salesperson_123",
            "message_text": "📢 **New Estimate Assigned**\n\n**Estimate #**: 1234\n**Client**: John Doe\n**Address**: 123 Main St, Anytown\n**Status**: Pending"
        },
        {
            "recipient_telegram_id": "manager_456",
            "message_text": "✅ **Estimate Approved**\n\n**Estimate #**: 5678\n**Client**: Jane Smith\n**Salesperson**: Bob Johnson"
        }
    ]
}
```

**Errors**
- 401: Unauthorized (token is missing or invalid).
- 403: Forbidden (user is not an administrator).
- 500: Internal server error. 

---

## Make.com Endpoints

A collection of endpoints specifically designed to be used as webhooks or API calls within Make.com scenarios to facilitate automation with services like Telegram.

- **Authentication**: All endpoints in this section are protected by a static API key. The key must be sent in the `X-API-Key` header.

### Find User by Telegram ID
Finds a user, salesperson, or crew member by their Telegram ID.

- **Endpoint**: `POST /make/find-user`
- **Body**: `{ "telegram_id": "123456789" }`
- **Success Response**: A JSON object with the user's details (`entity_id`, `name`, `role`, `branches`, `exists`).

### Verify Access Key
Verifies a user's access key for the Telegram bot.

- **Endpoint**: `POST /make/verify-access`
- **Body**: `{ "accessKey": "THE_USER_KEY" }`
- **Success Response**: `{ "success": true, "message": "..." }` or `{ "success": false, "message": "..." }`.

### List All Branches
Provides a simple, numbered list of all branches, formatted for display in a chat application.

- **Endpoint**: `GET /make/branches/list`
- **Success Response**: A plain text response.
  ```
  Please reply with the number of the branch you want to check:

  1. Branch A
  2. Branch B
  ```

### Get Branch ID by Choice
Translates a user's numerical choice (from the list above) into a branch ID and name.

- **Endpoint**: `GET /make/branches/get-id-by-choice`
- **Query Parameter**: `choice` (e.g., `?choice=1`)
- **Success Response**: `{ "branchId": 1, "branchName": "Branch A" }`

### List Salespersons by Branch Choice
Provides a numbered list of salespersons for a branch selected by a numerical choice. This is useful for chained questions in automations.

- **Endpoint**: `GET /make/salespersons/list-by-branch-choice`
- **Query Parameter**: `choice` (The number corresponding to the branch selection from the "List All Branches" endpoint, e.g., `?choice=1`)
- **Success Response**: A plain text response, ready for the next question.
  ```
  Please reply with the number of the salesperson:

  1. John Doe
  2. Jane Smith
  ```
- **Note**: If no salespersons are found, it returns a plain text message indicating so. This list only includes salespersons who do not already have a Telegram ID.

### Prepare Telegram ID Assignment
Verifies the selected branch and salesperson and returns a confirmation message to be shown to the user before the final registration. This step does **not** write to the database.

- **Endpoint**: `POST /make/salespersons/prepare-assignment`
- **Body**:
  ```json
  {
      "branch_choice": 1,
      "salesperson_choice": 2
  }
  ```
- **Success Response**: 
  ```json
  {
      "success": true,
      "message": "Hello, John Doe you are about to be registered to Branch A. Is this correct?",
      "salesperson_name": "John Doe",
      "branch_name": "Branch A"
  }
  ```

### Confirm Telegram ID Assignment
Performs the final registration, assigning the Telegram ID to the selected salesperson. This is the only step that writes to the database.

- **Endpoint**: `POST /make/salespersons/confirm-assignment`
- **Body**:
  ```json
  {
      "branch_choice": 1,
      "salesperson_choice": 2,
      "telegram_id": "123456789"
  }
  ```
- **Success Response**: `{ "success": true, "message": "Confirmed! John Doe has been successfully registered to Branch A." }`

### Get Salespersons Without Telegram ID
Gets a list of salespersons for a specific branch who do not have a Telegram ID registered.

- **Endpoint**: `GET /make/branches/{id}/salespersons-no-telegram`
- **Path Parameter**: `id` (The numerical ID of the branch)
- **Success Response**: A JSON array of salesperson objects `[{ "id": 1, "name": "John Doe" }]`.

### Find Telegram ID by Name (Fuzzy Search)
Busca el telegram_id de un vendedor utilizando su nombre con soporte para búsqueda aproximada. Maneja variaciones como nombres incompletos o con errores tipográficos.

- **Endpoint**: `POST /make/find-telegram-by-name`
- **Authentication**: Requiere `X-API-Key` en el header
- **Body**:
  ```json
  {
      "name": "Marcelo Ariel Sznek"
  }
  ```

**Casos de Uso:**
- Nombre exacto: `"Marcelo Sznek"` → encuentra `"Marcelo Sznek"`
- Nombre con segundo nombre: `"Marcelo Ariel Sznek"` → encuentra `"Marcelo Sznek"`
- Error tipográfico: `"Marclo Sznek"` → encuentra `"Marcelo Sznek"`
- Nombre parcial: `"Marcelo"` → encuentra `"Marcelo Sznek"`

**Success Response - Match Exacto (200)**:
```json
{
    "success": true,
    "exact_match": true,
    "salesperson_id": 42,
    "name": "Marcelo Sznek",
    "first_name": "Marcelo",
    "last_name": "Sznek",
    "telegram_id": "123456789",
    "has_telegram": true,
    "branches": [
        {"id": 1, "name": "San Bernardino"},
        {"id": 3, "name": "Orange County"}
    ]
}
```

**Success Response - Match Aproximado (200)**:
```json
{
    "success": true,
    "exact_match": false,
    "fuzzy_match": true,
    "searched_name": "Marcelo Ariel Sznek",
    "salesperson_id": 42,
    "name": "Marcelo Sznek",
    "first_name": "Marcelo",
    "last_name": "Sznek",
    "telegram_id": "123456789",
    "has_telegram": true,
    "similarity_score": 0.85,
    "branches": [
        {"id": 1, "name": "San Bernardino"}
    ],
    "other_matches": [
        {
            "salesperson_id": 43,
            "name": "Marco Sznek",
            "first_name": "Marco",
            "last_name": "Sznek",
            "telegram_id": null,
            "has_telegram": false,
            "similarity_score": 0.72,
            "branches": []
        }
    ]
}
```

**Response - Sin Match Claro (200)**:
```json
{
    "success": false,
    "message": "Multiple similar names found, please be more specific",
    "searched_name": "Marc",
    "suggestions": [
        {
            "salesperson_id": 42,
            "name": "Marcelo Sznek",
            "first_name": "Marcelo",
            "last_name": "Sznek",
            "telegram_id": "123456789",
            "has_telegram": true,
            "similarity_score": 0.65,
            "branches": [{"id": 1, "name": "San Bernardino"}]
        },
        {
            "salesperson_id": 44,
            "name": "Marcus Johnson",
            "first_name": "Marcus",
            "last_name": "Johnson",
            "telegram_id": null,
            "has_telegram": false,
            "similarity_score": 0.58,
            "branches": [{"id": 2, "name": "Kent"}]
        }
    ]
}
```

**Response - No Encontrado (200)**:
```json
{
    "success": false,
    "message": "No salesperson found with similar name",
    "searched_name": "Nombre Inexistente",
    "suggestions": []
}
```

**Error Responses:**
- `400 Bad Request`: Nombre faltante o inválido
- `401 Unauthorized`: API key faltante
- `403 Forbidden`: API key inválido  
- `500 Internal Server Error`: Error del servidor

**Notas:**
- El algoritmo considera coincidencias exactas, parciales y con errores tipográficos
- Si `similarity_score > 0.7`, se considera un match válido automáticamente
- El campo `has_telegram` indica si el vendedor ya tiene telegram_id configurado
- Se incluyen las branches asociadas al vendedor para contexto adicional

--- 