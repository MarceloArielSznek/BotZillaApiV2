-- =====================================================
-- PRODUCTION MIGRATION: Operation Command Post Table
-- Date: 2025-10-30
-- =====================================================

-- First, check if table exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'botzilla' 
        AND table_name = 'operation_command_post'
    ) THEN
        RAISE NOTICE 'Table operation_command_post already exists, skipping creation';
    ELSE
        -- Create operation_command_post table
        CREATE TABLE botzilla.operation_command_post (
            id SERIAL PRIMARY KEY,
            post TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        RAISE NOTICE 'Table operation_command_post created successfully';
    END IF;
END $$;

-- Add operation_post_id column to job table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'botzilla' 
        AND table_name = 'job' 
        AND column_name = 'operation_post_id'
    ) THEN
        ALTER TABLE botzilla.job 
        ADD COLUMN operation_post_id INTEGER;
        
        RAISE NOTICE 'Column operation_post_id added to job table';
    ELSE
        RAISE NOTICE 'Column operation_post_id already exists in job table';
    END IF;
END $$;

-- Add foreign key constraint if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.table_constraints 
        WHERE table_schema = 'botzilla' 
        AND table_name = 'job' 
        AND constraint_name = 'fk_job_operation_post'
    ) THEN
        ALTER TABLE botzilla.job
        ADD CONSTRAINT fk_job_operation_post
        FOREIGN KEY (operation_post_id)
        REFERENCES botzilla.operation_command_post(id)
        ON DELETE SET NULL;
        
        RAISE NOTICE 'Foreign key constraint fk_job_operation_post added';
    ELSE
        RAISE NOTICE 'Foreign key constraint fk_job_operation_post already exists';
    END IF;
END $$;

-- Create index if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_indexes 
        WHERE schemaname = 'botzilla' 
        AND tablename = 'job' 
        AND indexname = 'idx_job_operation_post_id'
    ) THEN
        CREATE INDEX idx_job_operation_post_id ON botzilla.job(operation_post_id);
        
        RAISE NOTICE 'Index idx_job_operation_post_id created';
    ELSE
        RAISE NOTICE 'Index idx_job_operation_post_id already exists';
    END IF;
END $$;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check if operation_command_post table exists
SELECT 'operation_command_post table' AS check_type, 
       CASE WHEN EXISTS (
           SELECT FROM information_schema.tables 
           WHERE table_schema = 'botzilla' 
           AND table_name = 'operation_command_post'
       ) THEN '✅ EXISTS' ELSE '❌ MISSING' END AS status;

-- Check if operation_post_id column exists in job table
SELECT 'operation_post_id column' AS check_type,
       CASE WHEN EXISTS (
           SELECT FROM information_schema.columns
           WHERE table_schema = 'botzilla'
           AND table_name = 'job'
           AND column_name = 'operation_post_id'
       ) THEN '✅ EXISTS' ELSE '❌ MISSING' END AS status;

-- Check if foreign key constraint exists
SELECT 'fk_job_operation_post constraint' AS check_type,
       CASE WHEN EXISTS (
           SELECT FROM information_schema.table_constraints 
           WHERE table_schema = 'botzilla' 
           AND table_name = 'job' 
           AND constraint_name = 'fk_job_operation_post'
       ) THEN '✅ EXISTS' ELSE '❌ MISSING' END AS status;

-- Check if index exists
SELECT 'idx_job_operation_post_id index' AS check_type,
       CASE WHEN EXISTS (
           SELECT FROM pg_indexes 
           WHERE schemaname = 'botzilla' 
           AND tablename = 'job' 
           AND indexname = 'idx_job_operation_post_id'
       ) THEN '✅ EXISTS' ELSE '❌ MISSING' END AS status;


