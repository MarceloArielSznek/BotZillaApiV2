-- ============================================================================
-- PRODUCTION MIGRATION: Corporate Employees Support
-- Date: 2025-10-20
-- Author: BotZilla Development Team
-- Description: Adds support for corporate employees with user account creation
-- ============================================================================
-- 
-- This migration adds:
-- 1. "Corporate" branch for initial employee registration
-- 2. Updates employee role constraint to include 'corporate' role
-- 3. Allows corporate employees to be converted to system users on activation
--
-- IMPORTANT: Run this on production database
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. CREATE "CORPORATE" BRANCH
-- ============================================================================
-- This branch is used only during employee registration form
-- Real branches are assigned when admin activates the employee

DO $$
BEGIN
    -- Check if Corporate branch already exists
    IF NOT EXISTS (SELECT 1 FROM botzilla.branch WHERE name = 'Corporate') THEN
        INSERT INTO botzilla.branch (name, address)
        VALUES ('Corporate', 'Corporate Office');
        
        RAISE NOTICE 'Corporate branch created successfully';
    ELSE
        RAISE NOTICE 'Corporate branch already exists, skipping creation';
    END IF;
END $$;

-- ============================================================================
-- 2. UPDATE EMPLOYEE ROLE CONSTRAINT
-- ============================================================================
-- Add 'corporate' as a valid employee role
-- Corporate employees will be converted to users in the 'user' table on activation

DO $$
BEGIN
    -- Drop existing constraint
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'employee_role_check' 
        AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'botzilla')
    ) THEN
        ALTER TABLE botzilla.employee DROP CONSTRAINT employee_role_check;
        RAISE NOTICE 'Existing employee_role_check constraint dropped';
    END IF;

    -- Create new constraint with 'corporate' included
    ALTER TABLE botzilla.employee 
    ADD CONSTRAINT employee_role_check 
    CHECK (role IN ('crew_member', 'crew_leader', 'salesperson', 'corporate'));
    
    RAISE NOTICE 'New employee_role_check constraint created with corporate role';
END $$;

-- ============================================================================
-- 3. VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify the migration was successful

-- Verify Corporate branch exists
SELECT 
    id, 
    name, 
    address,
    created_at
FROM botzilla.branch 
WHERE name = 'Corporate';

-- Verify role constraint includes 'corporate'
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname = 'employee_role_check'
AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'botzilla');

-- Count users by role
SELECT 
    rol.name AS role_name,
    COUNT(u.id) AS user_count
FROM botzilla.user u
JOIN botzilla.user_rol rol ON u.rol_id = rol.id
GROUP BY rol.name
ORDER BY rol.name;

-- Count employees by role
SELECT 
    role,
    COUNT(*) AS employee_count
FROM botzilla.employee
GROUP BY role
ORDER BY role;

COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT (Use only if needed to undo changes)
-- ============================================================================
-- 
-- BEGIN;
-- 
-- -- Revert role constraint to original
-- ALTER TABLE botzilla.employee DROP CONSTRAINT IF EXISTS employee_role_check;
-- ALTER TABLE botzilla.employee 
-- ADD CONSTRAINT employee_role_check 
-- CHECK (role IN ('crew_member', 'crew_leader', 'salesperson'));
-- 
-- -- Delete Corporate branch (only if no employees are using it)
-- DELETE FROM botzilla.branch WHERE name = 'Corporate' 
-- AND NOT EXISTS (
--     SELECT 1 FROM botzilla.employee WHERE branch_id = (
--         SELECT id FROM botzilla.branch WHERE name = 'Corporate'
--     )
-- );
-- 
-- COMMIT;
-- 
-- ============================================================================

-- ============================================================================
-- NOTES FOR PRODUCTION DEPLOYMENT
-- ============================================================================
--
-- WORKFLOW AFTER MIGRATION:
-- -------------------------
-- 1. Employee registers with role "corporate" and branch "Corporate"
-- 2. Admin reviews in dashboard → Employees → On-boarding tab
-- 3. Admin activates employee:
--    - Selects "Corporate" as final role
--    - Selects real branches (San Diego, Orange County, etc.)
--    - Selects user role (admin, manager, etc.)
-- 4. System creates user in 'user' table with:
--    - Selected user role (rol_id)
--    - Selected branches (user_branch table)
--    - Telegram ID for future notifications
--    - Auto-generated temporary password
-- 5. User appears in Settings → Users with full access
--
-- BRANCH MAPPING:
-- --------------
-- Frontend Name              → Database Name
-- "Everett (North Seattle)" → "Everett -WA"
-- "Kent (South Seattle)"    → "Kent -WA"
-- "Corporate"               → "Corporate"
-- "San Diego"               → "San Diego"
-- "Orange County"           → "Orange County"
-- "San Bernardino"          → "San Bernardino"
-- "Los Angeles"             → "Los Angeles"
--
-- SECURITY NOTES:
-- --------------
-- - Corporate branch is only for registration
-- - Real branches must be assigned during activation
-- - Corporate employees get system user accounts
-- - All other roles (crew, sales) remain unchanged
--
-- ============================================================================

