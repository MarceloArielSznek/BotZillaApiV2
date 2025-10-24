-- =====================================================
-- PRODUCTION MIGRATION: QC Shifts & Job Structure Updates
-- Date: 2025-10-24
-- Description: 
--   1. Add employee_id to shift table
--   2. Fix crew_member_id FK to point to employee
--   3. Add sold_price to job table
--   4. Remove unused columns from job table
--   5. Add performance_status to job and shift tables
--   6. Create QC Special Shift if not exists
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: Add employee_id to shift table
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'botzilla' 
        AND table_name = 'shift' 
        AND column_name = 'employee_id'
    ) THEN
        ALTER TABLE botzilla.shift 
        ADD COLUMN employee_id INTEGER;
        
        ALTER TABLE botzilla.shift
        ADD CONSTRAINT fk_shift_employee
        FOREIGN KEY (employee_id) 
        REFERENCES botzilla.employee(id)
        ON DELETE SET NULL;
        
        CREATE INDEX idx_shift_employee_id ON botzilla.shift(employee_id);
        CREATE INDEX idx_shift_employee_job ON botzilla.shift(employee_id, job_id);
        
        COMMENT ON COLUMN botzilla.shift.employee_id IS 'ID del empleado (para Performance shifts). Apunta a employee.id';
        
        RAISE NOTICE 'Added employee_id column to shift table';
    ELSE
        RAISE NOTICE 'employee_id column already exists in shift table';
    END IF;
END $$;

-- =====================================================
-- STEP 2: Fix crew_member_id FK to point to employee
-- =====================================================
DO $$
BEGIN
    -- Drop existing FK if it points to crew_member
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_schema = 'botzilla' 
        AND tc.table_name = 'shift'
        AND tc.constraint_name = 'shift_crew_member_id_fkey'
        AND ccu.table_name = 'crew_member'
    ) THEN
        ALTER TABLE botzilla.shift DROP CONSTRAINT shift_crew_member_id_fkey;
        RAISE NOTICE 'Dropped old shift_crew_member_id_fkey constraint';
    END IF;
    
    -- Create new FK pointing to employee
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_schema = 'botzilla' 
        AND tc.table_name = 'shift'
        AND tc.constraint_name = 'shift_crew_member_id_fkey'
        AND ccu.table_name = 'employee'
    ) THEN
        ALTER TABLE botzilla.shift
        ADD CONSTRAINT shift_crew_member_id_fkey
        FOREIGN KEY (crew_member_id) 
        REFERENCES botzilla.employee(id)
        ON DELETE CASCADE;
        
        COMMENT ON CONSTRAINT shift_crew_member_id_fkey ON botzilla.shift IS 'FK to employee.id (supports both crew_members and performance employees)';
        
        RAISE NOTICE 'Created new shift_crew_member_id_fkey constraint pointing to employee';
    ELSE
        RAISE NOTICE 'shift_crew_member_id_fkey already points to employee';
    END IF;
END $$;

-- =====================================================
-- STEP 3: Add sold_price to job table
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'botzilla' 
        AND table_name = 'job' 
        AND column_name = 'sold_price'
    ) THEN
        ALTER TABLE botzilla.job 
        ADD COLUMN sold_price DECIMAL(10,2);
        
        CREATE INDEX idx_job_sold_price ON botzilla.job(sold_price);
        
        COMMENT ON COLUMN botzilla.job.sold_price IS 'Precio final de venta del job (para Performance)';
        
        RAISE NOTICE 'Added sold_price column to job table';
    ELSE
        RAISE NOTICE 'sold_price column already exists in job table';
    END IF;
END $$;

-- =====================================================
-- STEP 4: Remove unused columns from job table
-- =====================================================
DO $$
BEGIN
    -- Drop crew_leader_hours
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'botzilla' 
        AND table_name = 'job' 
        AND column_name = 'crew_leader_hours'
    ) THEN
        ALTER TABLE botzilla.job DROP COLUMN crew_leader_hours;
        RAISE NOTICE 'Dropped crew_leader_hours column from job table';
    ELSE
        RAISE NOTICE 'crew_leader_hours column does not exist';
    END IF;
    
    -- Drop note
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'botzilla' 
        AND table_name = 'job' 
        AND column_name = 'note'
    ) THEN
        ALTER TABLE botzilla.job DROP COLUMN note;
        RAISE NOTICE 'Dropped note column from job table';
    ELSE
        RAISE NOTICE 'note column does not exist';
    END IF;
END $$;

-- =====================================================
-- STEP 5: Add performance_status to job table
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'botzilla' 
        AND table_name = 'job' 
        AND column_name = 'performance_status'
    ) THEN
        ALTER TABLE botzilla.job 
        ADD COLUMN performance_status VARCHAR(20) DEFAULT 'synced';
        
        ALTER TABLE botzilla.job
        ADD CONSTRAINT check_job_performance_status
        CHECK (performance_status IN ('synced', 'pending_approval', 'approved'));
        
        CREATE INDEX idx_job_performance_status ON botzilla.job(performance_status);
        CREATE INDEX idx_job_branch_performance_status ON botzilla.job(branch_id, performance_status);
        
        COMMENT ON COLUMN botzilla.job.performance_status IS 'Estado de aprobación de Performance: synced (normal), pending_approval (esperando), approved (aprobado)';
        COMMENT ON CONSTRAINT check_job_performance_status ON botzilla.job IS 'Asegura que performance_status tenga valores válidos';
        
        RAISE NOTICE 'Added performance_status column to job table';
    ELSE
        RAISE NOTICE 'performance_status column already exists in job table';
    END IF;
END $$;

-- =====================================================
-- STEP 6: Add performance_status to shift table
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'botzilla' 
        AND table_name = 'shift' 
        AND column_name = 'performance_status'
    ) THEN
        ALTER TABLE botzilla.shift 
        ADD COLUMN performance_status VARCHAR(20) DEFAULT 'approved';
        
        ALTER TABLE botzilla.shift
        ADD CONSTRAINT check_shift_performance_status
        CHECK (performance_status IN ('pending_approval', 'approved', 'rejected'));
        
        CREATE INDEX idx_shift_performance_status ON botzilla.shift(performance_status);
        CREATE INDEX idx_shift_job_performance_status ON botzilla.shift(job_id, performance_status);
        
        COMMENT ON COLUMN botzilla.shift.performance_status IS 'Estado de aprobación: pending_approval (esperando), approved (aprobado), rejected (rechazado)';
        COMMENT ON CONSTRAINT check_shift_performance_status ON botzilla.shift IS 'Asegura que performance_status tenga valores válidos';
        
        RAISE NOTICE 'Added performance_status column to shift table';
    ELSE
        RAISE NOTICE 'performance_status column already exists in shift table';
    END IF;
END $$;

-- =====================================================
-- STEP 7: Create QC Special Shift if not exists
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM botzilla.special_shift 
        WHERE name = 'QC'
    ) THEN
        INSERT INTO botzilla.special_shift (name, description)
        VALUES ('QC', 'Quality Control - 3 hours per shift');
        
        RAISE NOTICE 'Created QC Special Shift';
    ELSE
        RAISE NOTICE 'QC Special Shift already exists';
    END IF;
END $$;

-- =====================================================
-- STEP 8: Verify critical constraints
-- =====================================================
DO $$
DECLARE
    constraint_count INTEGER;
BEGIN
    -- Verify shift.crew_member_id FK points to employee
    SELECT COUNT(*) INTO constraint_count
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_schema = 'botzilla' 
    AND tc.table_name = 'shift'
    AND tc.constraint_name = 'shift_crew_member_id_fkey'
    AND ccu.table_name = 'employee';
    
    IF constraint_count = 0 THEN
        RAISE EXCEPTION 'CRITICAL: shift.crew_member_id FK does not point to employee!';
    END IF;
    
    RAISE NOTICE 'Verification passed: shift.crew_member_id correctly points to employee';
END $$;

COMMIT;

-- =====================================================
-- Post-Migration Verification Queries
-- =====================================================
-- Run these after migration to verify success:
/*
-- 1. Check new columns exist
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'botzilla' 
AND table_name IN ('job', 'shift') 
AND column_name IN ('employee_id', 'sold_price', 'performance_status')
ORDER BY table_name, column_name;

-- 2. Check constraints
SELECT constraint_name, table_name 
FROM information_schema.table_constraints 
WHERE table_schema = 'botzilla' 
AND constraint_name LIKE '%performance_status%';

-- 3. Check QC Special Shift
SELECT * FROM botzilla.special_shift WHERE name = 'QC';

-- 4. Check shift FK points to employee
SELECT tc.constraint_name, tc.table_name, ccu.table_name as references_table
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_schema = 'botzilla' 
AND tc.table_name = 'shift'
AND tc.constraint_name = 'shift_crew_member_id_fkey';
*/

-- =====================================================
-- ROLLBACK (Emergency Only)
-- =====================================================
/*
BEGIN;

-- Rollback performance_status from shift
ALTER TABLE botzilla.shift DROP CONSTRAINT IF EXISTS check_shift_performance_status;
DROP INDEX IF EXISTS botzilla.idx_shift_performance_status;
DROP INDEX IF EXISTS botzilla.idx_shift_job_performance_status;
ALTER TABLE botzilla.shift DROP COLUMN IF EXISTS performance_status;

-- Rollback performance_status from job
ALTER TABLE botzilla.job DROP CONSTRAINT IF EXISTS check_job_performance_status;
DROP INDEX IF EXISTS botzilla.idx_job_performance_status;
DROP INDEX IF EXISTS botzilla.idx_job_branch_performance_status;
ALTER TABLE botzilla.job DROP COLUMN IF EXISTS performance_status;

-- Rollback sold_price
DROP INDEX IF EXISTS botzilla.idx_job_sold_price;
ALTER TABLE botzilla.job DROP COLUMN IF EXISTS sold_price;

-- Rollback shift FK (restore to crew_member)
ALTER TABLE botzilla.shift DROP CONSTRAINT IF EXISTS shift_crew_member_id_fkey;
ALTER TABLE botzilla.shift
ADD CONSTRAINT shift_crew_member_id_fkey
FOREIGN KEY (crew_member_id) 
REFERENCES botzilla.crew_member(id)
ON DELETE CASCADE;

-- Rollback employee_id
DROP INDEX IF EXISTS botzilla.idx_shift_employee_job;
DROP INDEX IF EXISTS botzilla.idx_shift_employee_id;
ALTER TABLE botzilla.shift DROP CONSTRAINT IF EXISTS fk_shift_employee;
ALTER TABLE botzilla.shift DROP COLUMN IF EXISTS employee_id;

-- Delete QC special shift (optional, only if it was just created)
-- DELETE FROM botzilla.special_shift WHERE name = 'QC';

COMMIT;
*/

