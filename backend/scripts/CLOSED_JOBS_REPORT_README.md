# 📊 Closed Jobs Report Generator

Script standalone para exportar Closed Jobs desde Attic Tech API a Excel.

## 🎯 Características

- ✅ Selección interactiva de branch
- ✅ Rango de fechas flexible (mm/dd/yyyy)
- ✅ Filtrado por estado "Closed Job"
- ✅ Exportación a Excel con formato profesional
- ✅ Incluye datos del job y estimate asociado

## 📋 Datos exportados

Por cada job cerrado, el Excel incluye:

1. **Job Name**: Nombre del trabajo (texto)
2. **Scheduled Date**: Fecha programada del trabajo (texto mm/dd/yyyy)
3. **AT Estimated Hours**: Horas estimadas del estimate (número con 2 decimales)
4. **Final Price**: Precio final del estimate (número con formato de moneda $#,##0.00)

> **Nota importante**: Los campos numéricos (horas y precio) se guardan como números reales en Excel, no como texto. Esto permite usarlos en fórmulas y cálculos.

## 🚀 Instalación

### Opción 1: Ejecutar desde el proyecto BotZilla

```bash
cd /Users/marce/Desktop/Development/botzilla-dev/BotZillaApiV2/backend
npm install  # Si aún no has instalado las dependencias
node scripts/exportClosedJobsReport.js
```

### Opción 2: Ejecutar como script independiente

1. Copia el archivo `exportClosedJobsReport.js` a cualquier carpeta
2. Instala las dependencias necesarias:

```bash
npm install axios exceljs
```

3. Ejecuta el script:

```bash
node exportClosedJobsReport.js
```

## 📖 Uso

1. **Ejecuta el script**:
   ```bash
   node scripts/exportClosedJobsReport.js
   ```

2. **Selecciona un branch**:
   ```
   📋 Available Branches:
      1. Kent (ID: 123...)
      2. Everett (ID: 456...)
      3. Seattle (ID: 789...)
   
   🏢 Select a branch (enter number): 1
   ```

3. **Ingresa la fecha de inicio** (formato mm/dd/yyyy):
   ```
   📅 Enter start date (mm/dd/yyyy): 01/01/2025
   ```

4. **Ingresa la fecha de fin** (formato mm/dd/yyyy):
   ```
   📅 Enter end date (mm/dd/yyyy): 01/31/2025
   ```

5. **Espera a que se genere el archivo**:
   ```
   📦 Fetching closed jobs...
   ✅ Total closed jobs found: 45
   
   📊 Generating Excel file...
   ✅ Excel file generated successfully!
   
   📁 File saved to: ../exports/closed_jobs_kent_2025-01-15.xlsx
   ```

## 📁 Ubicación de archivos

Los archivos Excel se guardan en la carpeta `backend/exports/` con el formato:

```
closed_jobs_[branch]_[fecha].xlsx
```

Ejemplo: `closed_jobs_kent_2025-01-15.xlsx`

## 🔐 Credenciales

El script usa las siguientes credenciales de Attic Tech (ya configuradas en el código):

- **Email**: marcelosz.office@gmail.com
- **Password**: Fideo2022!

> ⚠️ **IMPORTANTE**: Si necesitas cambiar las credenciales, edita las líneas 24-27 del archivo `exportClosedJobsReport.js`

## 🛠️ Troubleshooting

### Error: "Cannot find module 'axios'"

**Solución**: Instala las dependencias:
```bash
npm install axios exceljs
```

### Error: "Invalid date format"

**Solución**: Asegúrate de ingresar las fechas en formato `mm/dd/yyyy`:
- ✅ Correcto: `01/15/2025`
- ❌ Incorrecto: `15/01/2025`, `1/15/2025`, `2025-01-15`

### No se encuentran jobs

**Posibles causas**:
- El branch seleccionado no tiene jobs en ese rango de fechas
- Los jobs no están en estado "Closed Job"
- Las fechas están fuera del rango donde existen jobs

**Solución**: Verifica en Attic Tech que existan jobs cerrados en ese branch y fechas.

### Error: "Login failed"

**Solución**: Verifica que las credenciales en el script sean correctas y que tengas acceso a la API de Attic Tech.

## 📝 Notas

- El script hace paginación automática si hay más de 100 jobs
- Para branches Kent y Everett, se usa el precio con impuestos (`final_price_after_taxes`)
- Si un job no tiene estimate asociado, se mostrará "N/A" en los campos correspondientes
- El script es seguro para ejecutar múltiples veces (no modifica datos, solo lee)

## 🔄 Actualizaciones

### Versión 1.0 (Enero 2025)
- ✅ Implementación inicial
- ✅ Selección de branch interactiva
- ✅ Rango de fechas personalizado
- ✅ Exportación a Excel
- ✅ Manejo de precios con impuestos para Kent/Everett

## 📧 Soporte

Si tienes problemas con el script, verifica:
1. Que las dependencias estén instaladas (`axios`, `exceljs`)
2. Que las credenciales de Attic Tech sean correctas
3. Que tengas conexión a internet
4. Que la API de Attic Tech esté funcionando

Para más ayuda, contacta al equipo de desarrollo.

