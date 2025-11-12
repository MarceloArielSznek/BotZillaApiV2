-- ============================================================================
-- MIGRATION: Add exported_to_spreadsheet to inspection_report
-- Date: 2025-11-11
-- Description: Agregar campo de control para rastrear qué reportes ya fueron
--              exportados al spreadsheet en Make.com
-- ============================================================================

-- Set search path
SET search_path TO botzilla;

-- Agregar la columna exported_to_spreadsheet
ALTER TABLE botzilla.inspection_report
ADD COLUMN exported_to_spreadsheet BOOLEAN NOT NULL DEFAULT FALSE;

-- Agregar comentario a la columna
COMMENT ON COLUMN botzilla.inspection_report.exported_to_spreadsheet IS 
'Indica si el reporte ya fue exportado al spreadsheet. Se marca como true después de enviarlo a Make.com';

-- Crear índice para mejorar consultas de reportes pendientes de exportación
CREATE INDEX IF NOT EXISTS idx_inspection_report_exported 
ON botzilla.inspection_report(exported_to_spreadsheet);

-- Verificación
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'botzilla' 
  AND table_name = 'inspection_report' 
  AND column_name = 'exported_to_spreadsheet';

