# 💡 Closed Jobs Report - Ejemplos de Uso

## 📺 Ejemplo Completo de Ejecución

### Paso a Paso

```bash
$ cd /Users/marce/Desktop/Development/botzilla-dev/BotZillaApiV2/backend
$ node scripts/exportClosedJobsReport.js
```

**Salida del script:**

```
==============================================
   CLOSED JOBS REPORT GENERATOR
   Attic Tech API Export Tool
==============================================

🔑 Logging into Attic Tech...
✅ Successfully logged in to Attic Tech

🏢 Fetching branches...
✅ Found 5 branches

📋 Available Branches:
   1. Los Angeles (ID: 8)
   2. Orange County (ID: 5)
   3. San Diego (ID: 4)
   4. Everett -WA (ID: 3)
   5. Kent -WA  (ID: 2)

🏢 Select a branch (enter number): 2
✅ Selected: Kent -WA 

📅 Enter start date (mm/dd/yyyy): 09/01/2025
✅ Start date: 09/01/2025

📅 Enter end date (mm/dd/yyyy): 09/30/2025
✅ End date: 09/30/2025

📦 Fetching closed jobs...
   Branch ID: 2
   Date Range: 09/01/2025 - 09/30/2025

   📄 Fetched page 1: 15 jobs
✅ Total closed jobs found: 15

📊 Generating Excel file...

   🔍 Fetching estimate details for job: John Smith - Attic Insulation
   🔍 Fetching estimate details for job: Sarah Johnson - Crawlspace Work
   ...

✅ Excel file generated successfully!

📊 Summary:
   Branch: Kent -WA 
   Date Range: 09/01/2025 - 09/30/2025
   Total Jobs: 15
   Jobs with estimate data: 14
   Jobs without estimate: 1

📁 File saved to: /Users/marce/.../backend/exports/closed_jobs_kent_wa_2025-10-14.xlsx

✅ Process completed successfully!
```

---

## 📊 Ejemplo del Excel Generado

### Estructura del archivo:

**Nombre del archivo**: `closed_jobs_kent_wa_2025-10-14.xlsx`

**Contenido (Sheet: "Closed Jobs Report")**:

| Job Name | Scheduled Date | AT Estimated Hours | Final Price |
|----------|----------------|-------------------|-------------|
| John Smith - Attic Insulation | 09/05/2025 | 8 | $4,200.50 |
| Sarah Johnson - Crawlspace Work | 09/07/2025 | 12 | $6,500.00 |
| Mike Davis - Rodent Proof | 09/10/2025 | 6 | $3,150.75 |
| Jessica Wilson - Ventilation | 09/12/2025 | 4 | $2,800.00 |
| Robert Brown - Attic Clean | 09/15/2025 | 10 | $5,450.25 |
| ... | ... | ... | ... |

**Características del formato:**
- ✅ Header en azul con texto blanco
- ✅ Bordes en todas las celdas
- ✅ Columnas con anchos ajustados automáticamente
- ✅ Precios con formato de moneda ($)
- ✅ Fechas en formato mm/dd/yyyy

---

## 🎯 Casos de Uso Comunes

### Caso 1: Reporte Mensual de Kent

```bash
Branch: Kent -WA (opción 2)
Start Date: 01/01/2025
End Date: 01/31/2025
```

**Resultado**: Excel con todos los closed jobs de Kent en enero 2025

---

### Caso 2: Reporte Trimestral de Everett

```bash
Branch: Everett -WA (opción 3)
Start Date: 01/01/2025
End Date: 03/31/2025
```

**Resultado**: Excel con todos los closed jobs de Everett en el Q1 2025

---

### Caso 3: Reporte de Un Solo Día

```bash
Branch: Los Angeles (opción 1)
Start Date: 10/14/2025
End Date: 10/14/2025
```

**Resultado**: Excel con closed jobs de Los Angeles solo del 14 de octubre

---

### Caso 4: Reporte Anual

```bash
Branch: San Diego (opción 4)
Start Date: 01/01/2025
End Date: 12/31/2025
```

**Resultado**: Excel con todos los closed jobs de San Diego en 2025

---

## ⚠️ Ejemplos de Errores Comunes

### Error 1: Formato de Fecha Incorrecto

```
📅 Enter start date (mm/dd/yyyy): 2025-01-15
❌ Invalid date format. Please use mm/dd/yyyy (e.g., 01/15/2025)
```

**Solución**: Usar formato `mm/dd/yyyy` → `01/15/2025`

---

### Error 2: Fecha de Inicio Posterior a Fecha de Fin

```
📅 Enter start date (mm/dd/yyyy): 12/31/2025
✅ Start date: 12/31/2025

📅 Enter end date (mm/dd/yyyy): 01/01/2025
✅ End date: 01/01/2025

❌ Error: Start date must be before end date. Exiting...
```

**Solución**: Asegurarse de que la fecha de inicio sea anterior a la fecha de fin

---

### Error 3: No Se Encuentran Jobs

```
📦 Fetching closed jobs...
✅ Total closed jobs found: 0

⚠️  No closed jobs found for the selected criteria.
```

**Posibles causas**:
- No hay jobs cerrados en ese branch en esas fechas
- El rango de fechas está fuera de los datos disponibles

**Solución**: Verificar en Attic Tech que existan jobs cerrados en ese período

---

## 🔄 Múltiples Ejecuciones

Puedes ejecutar el script múltiples veces para diferentes branches o fechas:

### Ejemplo: Generar reportes para todos los branches de un mes

```bash
# Ejecución 1 - Kent
$ node scripts/exportClosedJobsReport.js
Branch: Kent -WA  (2)
Dates: 09/01/2025 - 09/30/2025
Output: closed_jobs_kent_wa_2025-10-14.xlsx

# Ejecución 2 - Everett
$ node scripts/exportClosedJobsReport.js
Branch: Everett -WA (3)
Dates: 09/01/2025 - 09/30/2025
Output: closed_jobs_everett_wa_2025-10-14.xlsx

# Ejecución 3 - Los Angeles
$ node scripts/exportClosedJobsReport.js
Branch: Los Angeles (1)
Dates: 09/01/2025 - 09/30/2025
Output: closed_jobs_los_angeles_2025-10-14.xlsx
```

---

## 📂 Ubicación de Archivos Generados

Todos los archivos Excel se guardan en:

```
/Users/marce/.../BotZillaApiV2/backend/exports/
```

Con el formato de nombre:
```
closed_jobs_[branch_name]_[fecha_generación].xlsx
```

**Ejemplos**:
- `closed_jobs_kent_wa_2025-10-14.xlsx`
- `closed_jobs_everett_wa_2025-10-14.xlsx`
- `closed_jobs_los_angeles_2025-10-15.xlsx`

---

## 💾 Backup y Compartir

### Para hacer backup:

```bash
# Copiar todos los reportes generados
cp backend/exports/closed_jobs_*.xlsx ~/Desktop/Reportes_Backup/
```

### Para compartir por email:

1. Navega a la carpeta `backend/exports/`
2. Busca el archivo generado (ej: `closed_jobs_kent_wa_2025-10-14.xlsx`)
3. Adjunta el archivo a tu email

---

## 🎨 Personalización

Si necesitas modificar el script, aquí están los puntos clave:

### Cambiar credenciales (líneas 24-27):

```javascript
const ATTIC_TECH_CONFIG = {
    email: 'tu-email@example.com',
    password: 'tu-password',
    baseUrl: 'https://www.attic-tech.com/api'
};
```

### Agregar más columnas al Excel (línea 205+):

```javascript
worksheet.columns = [
    { header: 'Job Name', key: 'job_name', width: 40 },
    { header: 'Scheduled Date', key: 'scheduled_date', width: 20 },
    { header: 'AT Estimated Hours', key: 'estimated_hours', width: 20 },
    { header: 'Final Price', key: 'final_price', width: 20 },
    // Agregar más columnas aquí
    { header: 'Nueva Columna', key: 'nueva_key', width: 30 }
];
```

---

## 📞 Soporte

Si tienes preguntas o problemas:

1. Revisa la documentación completa: `CLOSED_JOBS_REPORT_README.md`
2. Ejecuta los tests de diagnóstico:
   - `node scripts/testAtticTechConnection.js`
   - `node scripts/testJobStatuses.js`
3. Verifica que las dependencias estén instaladas
4. Contacta al equipo de desarrollo

---

**Última actualización**: Octubre 14, 2025  
**Versión**: 1.0

