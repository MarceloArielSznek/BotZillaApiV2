-- Migration: Add operation_command_post table and relation to job
-- Date: 2025-10-29
-- Description: Creates operation_command_post table to store operation command posts
--              and adds foreign key in job table

-- =====================================================
-- 1. Create operation_command_post table
-- =====================================================

CREATE TABLE IF NOT EXISTS botzilla.operation_command_post (
    id SERIAL PRIMARY KEY,
    post TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add comments
COMMENT ON TABLE botzilla.operation_command_post IS 'Stores operation command posts for high-performing jobs';
COMMENT ON COLUMN botzilla.operation_command_post.id IS 'Primary key';
COMMENT ON COLUMN botzilla.operation_command_post.post IS 'Long text post with operation command celebration message';
COMMENT ON COLUMN botzilla.operation_command_post.created_at IS 'Timestamp when post was created';
COMMENT ON COLUMN botzilla.operation_command_post.updated_at IS 'Timestamp when post was last updated';

-- =====================================================
-- 2. Add operation_post_id to job table
-- =====================================================

ALTER TABLE botzilla.job 
ADD COLUMN IF NOT EXISTS operation_post_id INTEGER;

-- Add foreign key constraint
ALTER TABLE botzilla.job
ADD CONSTRAINT fk_job_operation_post
FOREIGN KEY (operation_post_id)
REFERENCES botzilla.operation_command_post(id)
ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_job_operation_post_id ON botzilla.job(operation_post_id);

-- Add comment
COMMENT ON COLUMN botzilla.job.operation_post_id IS 'Foreign key to operation_command_post table (nullable)';

-- =====================================================
-- Verify the changes
-- =====================================================

-- Check if operation_command_post table exists
SELECT table_name, table_schema 
FROM information_schema.tables 
WHERE table_schema = 'botzilla' 
  AND table_name = 'operation_command_post';

-- Check if operation_post_id column exists in job table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'botzilla'
  AND table_name = 'job'
  AND column_name = 'operation_post_id';

