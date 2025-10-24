# 🚀 Quick Start - Closed Jobs Report

## Opción 1: Ejecución Rápida (Recomendada)

### Desde el proyecto BotZilla:

```bash
cd /Users/marce/Desktop/Development/botzilla-dev/BotZillaApiV2/backend
node scripts/exportClosedJobsReport.js
```

### Usando el script bash:

```bash
cd /Users/marce/Desktop/Development/botzilla-dev/BotZillaApiV2/backend/scripts
./runClosedJobsReport.sh
```

---

## Opción 2: Script Independiente (Portable)

Si quieres usar el script fuera del proyecto:

### 1. Copia estos archivos a una carpeta nueva:
```
exportClosedJobsReport.js
package.json
```

### 2. En esa carpeta, ejecuta:
```bash
npm install
node exportClosedJobsReport.js
```

---

## 📝 Ejemplo de Uso

```
🏢 Select a branch (enter number): 1
✅ Selected: Kent

📅 Enter start date (mm/dd/yyyy): 01/01/2025
✅ Start date: 01/01/2025

📅 Enter end date (mm/dd/yyyy): 01/31/2025
✅ End date: 01/31/2025

📦 Fetching closed jobs...
✅ Total closed jobs found: 45

📊 Generating Excel file...
✅ Excel file generated successfully!

📁 File saved to: ../exports/closed_jobs_kent_2025-01-15.xlsx
```

---

## 🔧 Troubleshooting Rápido

### Error: "Cannot find module 'axios'"
```bash
npm install axios exceljs
```

### Error: "Permission denied"
```bash
chmod +x exportClosedJobsReport.js
```

### No aparecen branches o jobs
- Verifica tu conexión a internet
- Verifica que las credenciales en el script sean correctas
- Verifica que existan jobs en ese rango de fechas en Attic Tech

---

## 📖 Documentación Completa

Para más detalles, lee el archivo: `CLOSED_JOBS_REPORT_README.md`

