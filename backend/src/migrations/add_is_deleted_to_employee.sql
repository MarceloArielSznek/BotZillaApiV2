-- Migración para agregar la columna is_deleted a la tabla employee

ALTER TABLE botzilla.employee
ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

-- Eliminar índices UNIQUE antiguos si existieran
DROP INDEX IF EXISTS botzilla.idx_employee_email;
DROP INDEX IF EXISTS botzilla.idx_employee_telegram_id;

-- Recrear índices UNIQUE con condición WHERE is_deleted = FALSE
CREATE UNIQUE INDEX idx_employee_email ON botzilla.employee (email) WHERE is_deleted = FALSE;
CREATE UNIQUE INDEX idx_employee_telegram_id ON botzilla.employee (telegram_id) WHERE is_deleted = FALSE AND telegram_id IS NOT NULL;
