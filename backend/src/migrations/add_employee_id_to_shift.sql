-- =====================================================
-- Migration: Add employee_id to shift table
-- Description: 
--   - Add employee_id column to support shifts from Performance
--   - Make crew_member_id nullable for backward compatibility
--   - Add constraint to ensure at least one ID is present
-- Date: 2025-10-24
-- =====================================================

BEGIN;

-- 1. Agregar columna employee_id
ALTER TABLE botzilla.shift 
ADD COLUMN employee_id INTEGER;

-- 2. Agregar foreign key a employee
ALTER TABLE botzilla.shift
ADD CONSTRAINT fk_shift_employee
FOREIGN KEY (employee_id) 
REFERENCES botzilla.employee(id)
ON DELETE CASCADE;

-- 3. Hacer crew_member_id nullable (para nuevos shifts de Performance)
ALTER TABLE botzilla.shift 
ALTER COLUMN crew_member_id DROP NOT NULL;

-- 4. Agregar constraint: al menos uno de los dos IDs debe estar presente
ALTER TABLE botzilla.shift
ADD CONSTRAINT check_shift_has_person
CHECK (
    (crew_member_id IS NOT NULL) OR 
    (employee_id IS NOT NULL)
);

-- 5. Crear índice para employee_id
CREATE INDEX idx_shift_employee_id ON botzilla.shift(employee_id);

-- 6. Agregar comentarios
COMMENT ON COLUMN botzilla.shift.employee_id IS 'ID del empleado (usado para shifts de Performance)';
COMMENT ON CONSTRAINT check_shift_has_person ON botzilla.shift IS 'Asegura que al menos crew_member_id o employee_id esté presente';

COMMIT;

-- =====================================================
-- Rollback (si es necesario):
-- =====================================================
-- BEGIN;
-- ALTER TABLE botzilla.shift DROP CONSTRAINT check_shift_has_person;
-- ALTER TABLE botzilla.shift DROP CONSTRAINT fk_shift_employee;
-- ALTER TABLE botzilla.shift DROP COLUMN employee_id;
-- ALTER TABLE botzilla.shift ALTER COLUMN crew_member_id SET NOT NULL;
-- COMMIT;

