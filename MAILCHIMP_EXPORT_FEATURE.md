# Mailchimp Export Feature

## 📋 Descripción

Funcionalidad para exportar datos de clientes de Estimates a un archivo Excel, preparado para importar a Mailchimp.

**✨ NUEVO**: Ahora puedes seleccionar exactamente qué estados de estimates quieres exportar (Lost, Won, Pending, etc.).

## ✅ Características

### 1. Filtros Personalizables
- **Estimate Status**: Selección múltiple de estados (ej: Lost, Won, Pending, etc.) - **REQUERIDO**
  - Por defecto pre-selecciona "Lost" para campañas de follow-up
  - Puedes seleccionar múltiples estados para análisis más amplios
- **Branches**: Selección múltiple de branches (ej: San Diego, Orange County, etc.)
- **Rango de Fechas**: From Date y To Date para filtrar estimates por `at_updated_date`

### 2. Campos Exportados
El archivo Excel contiene las siguientes columnas:
1. **First Name** - Primer nombre del cliente
2. **Last Name** - Apellido(s) del cliente
3. **Address** - Dirección del cliente
4. **Phone** - Teléfono del cliente
5. **Email** - Email del cliente
6. **Branch** - Branch al que pertenece el estimate
7. **Status** - Estado del estimate (Lost, Won, Pending, etc.) 🔴 **NUEVO**
8. **Updated At** - Fecha de última actualización (formato MM/DD/YYYY)

### 3. Interfaz de Usuario
- **Botón "Export for Mailchimp"** en el header de Lost Estimates (verde)
- **Modal interactivo** para seleccionar filtros
- **Validación** de campos requeridos
- **Feedback visual** durante la exportación

## 🎯 Cómo Usar

### Paso 1: Abrir el Modal
1. Navega a `/follow-up/estimates` (Lost Estimates)
2. Haz clic en el botón verde **"Export for Mailchimp"**

### Paso 2: Seleccionar Filtros
En el modal:
1. **Estimate Status**: Selecciona uno o más estados (requerido)
   - Por defecto: "Lost" (pre-seleccionado)
   - Ejemplo: Lost, o Lost + Won para análisis más amplio
2. **Branches**: Selecciona uno o más branches (requerido)
   - Ejemplo: San Diego, Orange County
3. **From Date**: Fecha de inicio (requerido)
   - Ejemplo: 2025-11-01
4. **To Date**: Fecha de fin (requerido)
   - Ejemplo: 2025-11-14

### Paso 3: Exportar
1. Haz clic en **"Export Excel"**
2. El archivo se descargará automáticamente
3. Nombre del archivo: `mailchimp_contacts_branches-X-Y_YYYY-MM-DD.xlsx`

## 📊 Ejemplos de Uso

### Ejemplo 1: Follow-Up de Lost Estimates
**Caso**: Exportar clientes "Lost" de San Diego y Orange County entre Nov 1-14, 2025

**Pasos**:
1. Status: "Lost" (pre-seleccionado por defecto)
2. Branches: San Diego, Orange County
3. From Date: 2025-11-01
4. To Date: 2025-11-14
5. Clic en "Export Excel"

### Ejemplo 2: Análisis de Múltiples Estados
**Caso**: Comparar clientes "Lost" vs "Won" para análisis de conversión

**Pasos**:
1. Status: "Lost", "Won" (seleccionar ambos)
2. Branches: Todos los branches
3. From Date: 2025-10-01
4. To Date: 2025-11-30
5. Clic en "Export Excel"
6. En el Excel, filtrar por columna "Status" para analizar cada grupo

**Resultado**: Archivo Excel con todos los clientes de esos branches actualizados en ese rango de fechas.

## 🔧 Implementación Técnica

### Backend

#### Endpoint
```
GET /api/estimates/export/mailchimp
```

**Query Parameters**:
- `branchIds`: string (IDs separados por comas, ej: "1,2,3")
- `startDate`: string (formato YYYY-MM-DD)
- `endDate`: string (formato YYYY-MM-DD)

**Headers**:
- `Authorization`: Bearer token (JWT)

**Response**:
- Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Content-Disposition: `attachment; filename="mailchimp_contacts_...xlsx"`

#### Controller Method
`EstimatesController.exportMailchimpList()`

**Características**:
- Filtra estimates por `branch_id` y `at_updated_date`
- Incluye datos del Branch asociado
- Genera Excel usando librería `xlsx`
- Ajusta ancho de columnas automáticamente
- Logging detallado para debugging

### Frontend

#### Componente Modal
`frontend/src/components/estimates/MailchimpExportModal.tsx`

**Características**:
- Carga dinámica de branches
- Selección múltiple de branches con chips
- Validación de campos requeridos
- Descarga automática del archivo
- Manejo de errores con alertas
- Loading states durante la exportación

#### Integración
- Botón en el header de `/follow-up/estimates`
- Estado local para controlar apertura/cierre del modal
- Import del componente modal

## 📁 Archivos Modificados/Creados

### Backend
1. **`backend/src/controllers/estimates.controller.js`**
   - Agregado import de `xlsx`
   - Nuevo método `exportMailchimpList()`

2. **`backend/src/routes/estimates.routes.js`**
   - Nueva ruta `GET /estimates/export/mailchimp`

### Frontend
1. **`frontend/src/components/estimates/MailchimpExportModal.tsx`** ✨ NUEVO
   - Componente modal para exportación

2. **`frontend/src/pages/FollowUpEstimates.tsx`**
   - Import de `MailchimpExportModal` y `DownloadIcon`
   - Nuevo estado `mailchimpExportOpen`
   - Botón "Export for Mailchimp" en el header
   - Instancia del modal al final del componente

## 🎨 Diseño Visual

### Botón de Export
- **Color**: Verde (`color="success"`)
- **Variante**: Contained
- **Icono**: Download icon
- **Posición**: Header, a la izquierda del botón "Refresh"

### Modal
- **Ancho**: `sm` (600px)
- **Título**: "Export for Mailchimp" con icono de descarga
- **Campos**:
  - Branches (Select múltiple con chips)
  - From Date (Date picker)
  - To Date (Date picker)
- **Info**: Alert azul con descripción de los datos exportados
- **Botones**:
  - Cancel (gris)
  - Export Excel (verde, con loading state)

## 🔐 Seguridad

- **Autenticación**: Requiere JWT token válido
- **Autorización**: Endpoint protegido con `verifyToken` middleware
- **Validación**: Campos requeridos validados en frontend y backend

## 📝 Notas

- El filtro usa `at_updated_date` (no `at_created_date`) para incluir estimates actualizados recientemente
- El archivo Excel se genera en memoria (no se guarda en el servidor)
- La descarga es automática después de la generación
- El modal se cierra automáticamente después de una descarga exitosa
- Los datos se ordenan por `at_updated_date DESC` (más recientes primero)

## 🚀 Próximas Mejoras Posibles

1. Agregar filtro por status de estimate
2. Permitir seleccionar qué campos exportar
3. Opción para exportar en formato CSV además de Excel
4. Agregar preview de datos antes de exportar
5. Guardar presets de filtros frecuentes
6. Agregar contador de registros que se van a exportar
7. Integración directa con Mailchimp API (opcional)

## ✅ Testing

Para probar la funcionalidad:

1. Navegar a `/follow-up/estimates`
2. Clic en "Export for Mailchimp"
3. Seleccionar San Diego y Orange County
4. From Date: 2025-11-01
5. To Date: 2025-11-14
6. Clic en "Export Excel"
7. Verificar que se descarga el archivo
8. Abrir el Excel y confirmar los datos correctos

**Resultado esperado**: Excel con 7 columnas (First Name, Last Name, Address, Phone, Email, Branch, Updated At) y todos los clientes de esos branches en ese rango de fechas.

