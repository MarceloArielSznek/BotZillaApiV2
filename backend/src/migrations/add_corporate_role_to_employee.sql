-- Migration: Add 'corporate' role to employee table
-- Date: 2025-10-20
-- Description: Updates the employee_role_check constraint to include 'corporate' as a valid role value

-- Drop existing constraint
ALTER TABLE botzilla.employee 
DROP CONSTRAINT IF EXISTS employee_role_check;

-- Create new constraint with 'corporate' included
ALTER TABLE botzilla.employee 
ADD CONSTRAINT employee_role_check 
CHECK (role IN ('crew_member', 'crew_leader', 'salesperson', 'corporate'));

-- Verify the constraint
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname = 'employee_role_check'
AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'botzilla');

