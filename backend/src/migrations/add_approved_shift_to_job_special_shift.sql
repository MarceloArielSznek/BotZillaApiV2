-- Agregar columna approved_shift a job_special_shift
ALTER TABLE botzilla.job_special_shift
ADD COLUMN approved_shift BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN botzilla.job_special_shift.approved_shift IS 'Indica si el special shift ha sido aprobado manualmente por un usuario';

-- Opcional: Actualizar registros existentes (marcar todos los viejos como aprobados)
UPDATE botzilla.job_special_shift
SET approved_shift = TRUE
WHERE approved_shift IS NULL; -- Solo si la columna existía antes y permitía NULL

-- Crear un índice para mejorar el rendimiento de las consultas de special shifts pendientes
CREATE INDEX idx_job_special_shift_approved_shift ON botzilla.job_special_shift (approved_shift);
