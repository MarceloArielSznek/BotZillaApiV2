-- Migración para agregar la columna approved_shift a la tabla shift
-- Fecha: 2025-09-08
-- Propósito: Permitir aprobación manual de shifts sugeridos antes de confirmarlos

-- Agregar la columna approved_shift
ALTER TABLE botzilla.shift 
ADD COLUMN approved_shift BOOLEAN NOT NULL DEFAULT FALSE;

-- Agregar comentario a la columna
COMMENT ON COLUMN botzilla.shift.approved_shift IS 'Indica si el shift ha sido aprobado manualmente por un usuario';

-- Actualizar shifts existentes como aprobados (retrocompatibilidad)
UPDATE botzilla.shift 
SET approved_shift = TRUE 
WHERE approved_shift IS NULL OR approved_shift = FALSE;

-- Crear índice para mejorar consultas de shifts pendientes de aprobación
CREATE INDEX idx_shift_approved_shift ON botzilla.shift(approved_shift);

-- Verificación
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'botzilla' 
  AND table_name = 'shift' 
  AND column_name = 'approved_shift';
