-- Migration: Add attic_tech_branch_id to branch table
-- Description: Links BotZilla branches to their corresponding Attic Tech branch IDs
-- Author: BotZilla API
-- Date: 2025-11-13

-- Add attic_tech_branch_id column (for branch reference)
ALTER TABLE botzilla.branch
ADD COLUMN IF NOT EXISTS attic_tech_branch_id INTEGER;

-- Add branch_configuration_id column (FK to branch_configuration)
ALTER TABLE botzilla.branch
ADD COLUMN IF NOT EXISTS branch_configuration_id INTEGER;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_branch_attic_tech_id 
    ON botzilla.branch(attic_tech_branch_id);

CREATE INDEX IF NOT EXISTS idx_branch_config_id 
    ON botzilla.branch(branch_configuration_id);

-- Add FK constraint to branch_configuration
ALTER TABLE botzilla.branch
    ADD CONSTRAINT IF NOT EXISTS fk_branch_configuration 
    FOREIGN KEY (branch_configuration_id) 
    REFERENCES botzilla.branch_configuration(id) 
    ON DELETE SET NULL;

-- Add comments
COMMENT ON COLUMN botzilla.branch.attic_tech_branch_id IS 'Branch ID in Attic Tech API (for syncing data)';
COMMENT ON COLUMN botzilla.branch.branch_configuration_id IS 'FK to branch_configuration table (contains baseConstants and multiplier_ranges)';

-- Ejemplos de cómo actualizar los branches existentes:
-- Nota: Primero debes sincronizar las configuraciones, luego actualizar los branches
-- El branch_configuration_id se asignará automáticamente durante el sync
-- UPDATE botzilla.branch SET attic_tech_branch_id = 1 WHERE name = 'San Bernardino';
-- UPDATE botzilla.branch SET attic_tech_branch_id = 2 WHERE name = 'Kent -WA';
-- UPDATE botzilla.branch SET attic_tech_branch_id = 3 WHERE name = 'Everett -WA';
-- UPDATE botzilla.branch SET attic_tech_branch_id = 4 WHERE name = 'San Diego';
-- UPDATE botzilla.branch SET attic_tech_branch_id = 5 WHERE name = 'Orange County';
-- UPDATE botzilla.branch SET attic_tech_branch_id = 8 WHERE name = 'Los Angeles';

