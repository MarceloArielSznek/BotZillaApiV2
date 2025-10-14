-- ============================================================================
-- Migración: Agregar attic_tech_user_id a tabla employee
-- Permite sincronizar empleados desde Attic Tech
-- ============================================================================

-- Agregar campo para guardar el ID de usuario de Attic Tech
ALTER TABLE botzilla.employee 
ADD COLUMN IF NOT EXISTS attic_tech_user_id INTEGER UNIQUE;

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_employee_attic_tech_user_id 
ON botzilla.employee(attic_tech_user_id);

-- Hacer que algunos campos sean opcionales para employees pending desde AT
-- Estos campos se completarán cuando el employee termine su registro

ALTER TABLE botzilla.employee 
ALTER COLUMN phone_number DROP NOT NULL,
ALTER COLUMN telegram_id DROP NOT NULL,
ALTER COLUMN street DROP NOT NULL,
ALTER COLUMN city DROP NOT NULL,
ALTER COLUMN state DROP NOT NULL,
ALTER COLUMN zip DROP NOT NULL,
ALTER COLUMN date_of_birth DROP NOT NULL;

-- Agregar comentarios
COMMENT ON COLUMN botzilla.employee.attic_tech_user_id IS 'ID del usuario en Attic Tech (para sincronización)';
COMMENT ON COLUMN botzilla.employee.phone_number IS 'Opcional para pending, requerido al activar';
COMMENT ON COLUMN botzilla.employee.telegram_id IS 'Opcional para pending, requerido al activar';

-- ============================================================================
-- NOTAS:
-- 1. Los employees "pending" desde AT solo tienen: name, email, role, branch
-- 2. Deben completar: phone, telegram_id, address, date_of_birth
-- 3. Al activar, se valida que todos los campos estén completos
-- ============================================================================

