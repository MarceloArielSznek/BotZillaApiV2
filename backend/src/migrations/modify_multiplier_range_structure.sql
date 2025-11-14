-- Migration: Modify multiplier range structure
-- Description: Rename table and change FK to point to branch_configuration instead of branch
-- Author: BotZilla API
-- Date: 2025-11-14

-- Rename table
ALTER TABLE IF EXISTS botzilla.branch_multiplier_config 
    RENAME TO multiplier_range;

-- Drop old FK constraint if exists
ALTER TABLE botzilla.multiplier_range 
    DROP CONSTRAINT IF EXISTS fk_branch_multiplier_config_branch;

-- Remove columns that should point to configuration instead
ALTER TABLE botzilla.multiplier_range 
    DROP COLUMN IF EXISTS at_branch_id,
    DROP COLUMN IF EXISTS branch_id;

-- Add FK to branch_configuration
ALTER TABLE botzilla.multiplier_range 
    ADD COLUMN IF NOT EXISTS branch_configuration_id INTEGER;

-- Add FK constraint
ALTER TABLE botzilla.multiplier_range
    ADD CONSTRAINT fk_multiplier_range_config 
    FOREIGN KEY (branch_configuration_id) 
    REFERENCES botzilla.branch_configuration(id) 
    ON DELETE CASCADE;

-- Create index
CREATE INDEX IF NOT EXISTS idx_multiplier_range_config_id 
    ON botzilla.multiplier_range(branch_configuration_id);

-- Add comment
COMMENT ON COLUMN botzilla.multiplier_range.branch_configuration_id IS 'FK to branch_configuration table';

