-- Migration: Create junction table for branch_configuration and multiplier_range (many-to-many)
-- Description: A configuration can have multiple ranges, and a range can belong to multiple configurations
-- Author: BotZilla API
-- Date: 2025-11-14

-- 1. Primero, eliminar la FK de multiplier_range
ALTER TABLE botzilla.multiplier_range 
    DROP CONSTRAINT IF EXISTS fk_multiplier_range_config;

ALTER TABLE botzilla.multiplier_range 
    DROP COLUMN IF EXISTS branch_configuration_id;

-- 2. Crear tabla de unión (junction table)
CREATE TABLE IF NOT EXISTS botzilla.branch_configuration_multiplier_range (
    id SERIAL PRIMARY KEY,
    branch_configuration_id INTEGER NOT NULL,
    multiplier_range_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- FKs
    CONSTRAINT fk_branch_config_mult_range_config 
        FOREIGN KEY (branch_configuration_id) 
        REFERENCES botzilla.branch_configuration(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_branch_config_mult_range_range 
        FOREIGN KEY (multiplier_range_id) 
        REFERENCES botzilla.multiplier_range(id) 
        ON DELETE CASCADE,
    
    -- Unique constraint: una configuración no puede tener el mismo range dos veces
    CONSTRAINT uk_config_range 
        UNIQUE (branch_configuration_id, multiplier_range_id)
);

-- 3. Crear índices
CREATE INDEX IF NOT EXISTS idx_branch_config_mult_range_config 
    ON botzilla.branch_configuration_multiplier_range(branch_configuration_id);

CREATE INDEX IF NOT EXISTS idx_branch_config_mult_range_range 
    ON botzilla.branch_configuration_multiplier_range(multiplier_range_id);

-- 4. Comentarios
COMMENT ON TABLE botzilla.branch_configuration_multiplier_range IS 'Junction table: relates configurations with their multiplier ranges (many-to-many)';
COMMENT ON COLUMN botzilla.branch_configuration_multiplier_range.branch_configuration_id IS 'FK to branch_configuration';
COMMENT ON COLUMN botzilla.branch_configuration_multiplier_range.multiplier_range_id IS 'FK to multiplier_range';

