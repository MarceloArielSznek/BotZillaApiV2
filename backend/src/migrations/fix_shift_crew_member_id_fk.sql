-- =====================================================
-- Migration: Fix shift.crew_member_id foreign key
-- Description: 
--   - Change crew_member_id FK from crew_member.id to employee.id
--   - This allows using employee_id as crew_member_id for Performance shifts
-- Date: 2025-10-24
-- =====================================================

BEGIN;

-- 1. Drop existing foreign key constraint
ALTER TABLE botzilla.shift 
DROP CONSTRAINT IF EXISTS shift_crew_member_id_fkey;

-- 2. Add new foreign key pointing to employee.id
ALTER TABLE botzilla.shift
ADD CONSTRAINT shift_crew_member_id_fkey
FOREIGN KEY (crew_member_id) 
REFERENCES botzilla.employee(id)
ON DELETE CASCADE;

-- 3. Add comment
COMMENT ON CONSTRAINT shift_crew_member_id_fkey ON botzilla.shift IS 'FK to employee.id (supports both crew_members and performance employees)';

COMMIT;

-- =====================================================
-- Rollback (si es necesario):
-- =====================================================
-- BEGIN;
-- ALTER TABLE botzilla.shift DROP CONSTRAINT shift_crew_member_id_fkey;
-- ALTER TABLE botzilla.shift
-- ADD CONSTRAINT shift_crew_member_id_fkey
-- FOREIGN KEY (crew_member_id) 
-- REFERENCES botzilla.crew_member(id)
-- ON DELETE CASCADE;
-- COMMIT;

