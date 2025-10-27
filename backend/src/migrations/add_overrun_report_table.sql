-- Migration: Add overrun_report table and relation to job
-- Date: 2025-10-27
-- Description: Creates overrun_report table to store overrun investigation reports
--              and adds foreign key in job table

-- =====================================================
-- 1. Create overrun_report table
-- =====================================================

CREATE TABLE IF NOT EXISTS botzilla.overrun_report (
    id SERIAL PRIMARY KEY,
    report TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add comments
COMMENT ON TABLE botzilla.overrun_report IS 'Stores investigation reports for overrun jobs';
COMMENT ON COLUMN botzilla.overrun_report.id IS 'Primary key';
COMMENT ON COLUMN botzilla.overrun_report.report IS 'Long text report with investigation details';
COMMENT ON COLUMN botzilla.overrun_report.created_at IS 'Timestamp when report was created';
COMMENT ON COLUMN botzilla.overrun_report.updated_at IS 'Timestamp when report was last updated';

-- =====================================================
-- 2. Add overrun_report_id to job table
-- =====================================================

ALTER TABLE botzilla.job 
ADD COLUMN IF NOT EXISTS overrun_report_id INTEGER;

-- Add foreign key constraint
ALTER TABLE botzilla.job
ADD CONSTRAINT fk_job_overrun_report
FOREIGN KEY (overrun_report_id)
REFERENCES botzilla.overrun_report(id)
ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_job_overrun_report_id ON botzilla.job(overrun_report_id);

-- Add comment
COMMENT ON COLUMN botzilla.job.overrun_report_id IS 'Foreign key to overrun_report table (nullable)';

-- =====================================================
-- Verify the changes
-- =====================================================

-- Check if overrun_report table exists
SELECT table_name, table_schema 
FROM information_schema.tables 
WHERE table_schema = 'botzilla' 
  AND table_name = 'overrun_report';

-- Check if overrun_report_id column exists in job table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'botzilla'
  AND table_name = 'job'
  AND column_name = 'overrun_report_id';

-- =====================================================
-- Rollback script (if needed)
-- =====================================================

/*
-- To rollback this migration:

ALTER TABLE botzilla.job DROP CONSTRAINT IF EXISTS fk_job_overrun_report;
ALTER TABLE botzilla.job DROP COLUMN IF EXISTS overrun_report_id;
DROP TABLE IF EXISTS botzilla.overrun_report CASCADE;
*/

