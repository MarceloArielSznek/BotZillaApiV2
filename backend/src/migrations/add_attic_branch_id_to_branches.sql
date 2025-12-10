-- Migration: Add attic_branch_id to branches table
-- Date: 2025-11-25
-- Purpose: Map BotZilla branches to Attic DB branches for New Performance System

BEGIN;

-- Add attic_branch_id column
ALTER TABLE botzilla.branch 
ADD COLUMN IF NOT EXISTS attic_branch_id INTEGER;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_branch_attic_id 
ON botzilla.branch(attic_branch_id);

-- Add comment
COMMENT ON COLUMN botzilla.branch.attic_branch_id 
IS 'Foreign key to Attic DB dim_attic_branch.branch_id for New Performance System';

-- Add unique constraint (one-to-one mapping)
ALTER TABLE botzilla.branch 
ADD CONSTRAINT unique_attic_branch_id 
UNIQUE (attic_branch_id);

-- Set default mappings based on current branches
-- Adjust these IDs according to your actual Attic DB branch_ids

-- Example mappings (update with real Attic branch_ids):
-- UPDATE botzilla.branch SET attic_branch_id = 1 WHERE name ILIKE '%San Diego%';
-- UPDATE botzilla.branch SET attic_branch_id = 2 WHERE name ILIKE '%Orange%';
-- UPDATE botzilla.branch SET attic_branch_id = 3 WHERE name ILIKE '%Los Angeles%';
-- UPDATE botzilla.branch SET attic_branch_id = 4 WHERE name ILIKE '%San Bernardino%';
-- UPDATE botzilla.branch SET attic_branch_id = 5 WHERE name ILIKE '%Kent%';
-- UPDATE botzilla.branch SET attic_branch_id = 6 WHERE name ILIKE '%Everett%';

COMMIT;

-- Rollback instructions:
-- BEGIN;
-- ALTER TABLE botzilla.branch DROP CONSTRAINT IF EXISTS unique_attic_branch_id;
-- DROP INDEX IF EXISTS botzilla.idx_branch_attic_id;
-- ALTER TABLE botzilla.branch DROP COLUMN IF EXISTS attic_branch_id;
-- COMMIT;

