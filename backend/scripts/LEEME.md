# 📊 Generador de Reportes de Closed Jobs

## 🎉 ¡Listo para Usar!

El script para exportar Closed Jobs desde Attic Tech a Excel está **completamente funcional y testeado**.

---

## 🚀 Inicio Rápido

### Para ejecutar el script:

```bash
cd /Users/marce/Desktop/Development/botzilla-dev/BotZillaApiV2/backend
node scripts/exportClosedJobsReport.js
```

### El script te pedirá:

1. **Seleccionar un branch** (Kent, Everett, Los Angeles, etc.)
2. **Fecha de inicio** en formato `mm/dd/yyyy` (ej: `01/01/2025`)
3. **Fecha de fin** en formato `mm/dd/yyyy` (ej: `01/31/2025`)

### El script generará:

Un archivo Excel en: `backend/exports/closed_jobs_[branch]_[fecha].xlsx`

Con las siguientes columnas:
- **Job Name** (Nombre del trabajo - texto)
- **Scheduled Date** (Fecha programada - texto mm/dd/yyyy)
- **AT Estimated Hours** (Horas estimadas del estimate - número con 2 decimales)
- **Final Price** (Precio final del estimate - número con formato de moneda)

> **✅ Los campos numéricos son números reales en Excel**, no texto. Puedes usarlos en fórmulas y cálculos.

---

## 📁 Archivos Creados

### Archivos Principales:

1. **`exportClosedJobsReport.js`** - Script principal (ejecutar este)
2. **`package.json`** - Dependencias para uso standalone

### Documentación:

3. **`LEEME.md`** - Este archivo (resumen en español)
4. **`CLOSED_JOBS_REPORT_README.md`** - Documentación completa en inglés
5. **`QUICK_START.md`** - Guía de inicio rápido
6. **`USAGE_EXAMPLES.md`** - Ejemplos detallados de uso
7. **`DEPLOYMENT_SUMMARY.md`** - Resumen técnico de deployment

### Scripts de Testing:

8. **`testAtticTechConnection.js`** - Test de conexión a API
9. **`testJobStatuses.js`** - Test de estados de jobs

### Utilidades:

10. **`runClosedJobsReport.sh`** - Script bash para ejecución rápida

---

## ✅ Todo Testeado

- ✅ Conexión a Attic Tech API funcionando
- ✅ Login exitoso con credenciales configuradas
- ✅ Branches endpoint funcionando (5 branches encontrados)
- ✅ Jobs endpoint funcionando (Closed Jobs encontrados)
- ✅ Estado correcto confirmado: "Closed Job" (singular)
- ✅ Dependencias instaladas (axios, exceljs)

---

## 💡 Ejemplo de Uso

```
$ node scripts/exportClosedJobsReport.js

==============================================
   CLOSED JOBS REPORT GENERATOR
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
✅ Total closed jobs found: 15

📊 Generating Excel file...
✅ Excel file generated successfully!

📁 File saved to: backend/exports/closed_jobs_kent_wa_2025-10-14.xlsx

✅ Process completed successfully!
```

---

## 🔐 Credenciales Configuradas

Las credenciales de Attic Tech ya están configuradas en el script:

```
Email: marcelosz.office@gmail.com
Password: Fideo2022!
```

Si necesitas cambiarlas, edita las líneas 24-27 de `exportClosedJobsReport.js`.

---

## 🌟 Características Especiales

- ✅ **Interactivo**: Interfaz amigable con selección de opciones
- ✅ **Validación de fechas**: Verifica formato correcto mm/dd/yyyy
- ✅ **Paginación automática**: Maneja más de 100 jobs sin problemas
- ✅ **Excel profesional**: Con headers de color, bordes y formato
- ✅ **Precios con impuestos**: Para Kent/Everett usa precio después de impuestos
- ✅ **Manejo de errores**: Si un job no tiene estimate, muestra "N/A"
- ✅ **Portable**: Puede ejecutarse fuera del proyecto

---

## 📊 Branches Disponibles

Según el último test, estos son los branches disponibles:

1. **Los Angeles** (ID: 8)
2. **Orange County** (ID: 5)
3. **San Diego** (ID: 4)
4. **Everett -WA** (ID: 3)
5. **Kent -WA** (ID: 2)

---

## 🛠️ Troubleshooting

### Si el script no encuentra jobs:

- Verifica que existan jobs cerrados en ese branch y fechas en Attic Tech
- Asegúrate de que el estado sea "Closed Job" (no "Closed Jobs")

### Si hay error de login:

```bash
# Ejecuta este test para verificar la conexión:
node scripts/testAtticTechConnection.js
```

### Si faltan dependencias:

```bash
npm install axios exceljs
```

---

## 📂 Uso Standalone (Fuera del Proyecto)

Si quieres usar el script en otra computadora o carpeta:

1. Copia estos archivos a una nueva carpeta:
   - `exportClosedJobsReport.js`
   - `package.json`

2. En esa carpeta, ejecuta:
   ```bash
   npm install
   node exportClosedJobsReport.js
   ```

---

## 📚 Más Información

Para más detalles, consulta estos archivos:

- **Documentación completa**: `CLOSED_JOBS_REPORT_README.md`
- **Guía rápida**: `QUICK_START.md`
- **Ejemplos de uso**: `USAGE_EXAMPLES.md`
- **Resumen técnico**: `DEPLOYMENT_SUMMARY.md`

---

## ✨ ¡Listo para Producción!

El script está completamente funcional y listo para usar. Todos los tests han pasado exitosamente.

**Para empezar, simplemente ejecuta:**

```bash
node scripts/exportClosedJobsReport.js
```

---

**Fecha de Creación**: 14 de Octubre, 2025  
**Versión**: 1.0  
**Estado**: ✅ Listo para Producción  
**Desarrollado por**: BotZilla Team

