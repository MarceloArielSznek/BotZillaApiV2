-- Migration: Create branch_multiplier_config table
-- Description: Stores pricing multiplier ranges from Attic Tech by branch
-- Author: BotZilla API
-- Date: 2025-11-13

-- Create branch_multiplier_config table
CREATE TABLE IF NOT EXISTS botzilla.branch_multiplier_config (
    id SERIAL PRIMARY KEY,
    at_branch_id INTEGER NOT NULL,
    branch_id INTEGER,
    name VARCHAR(100) NOT NULL,
    min_cost DECIMAL(10, 2) NOT NULL,
    max_cost DECIMAL(10, 2),
    lowest_multiple DECIMAL(5, 3) NOT NULL,
    highest_multiple DECIMAL(5, 3) NOT NULL,
    at_multiplier_range_id INTEGER NOT NULL UNIQUE,
    at_created_at TIMESTAMP,
    at_updated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign keys
    CONSTRAINT fk_branch_multiplier_config_branch
        FOREIGN KEY (branch_id)
        REFERENCES botzilla.branch(id)
        ON DELETE SET NULL,
    
    -- Constraints
    CONSTRAINT check_price_range CHECK (max_cost IS NULL OR max_cost >= min_cost),
    CONSTRAINT check_min_cost_positive CHECK (min_cost >= 0),
    CONSTRAINT check_lowest_multiple_positive CHECK (lowest_multiple > 0),
    CONSTRAINT check_highest_multiple_positive CHECK (highest_multiple > 0)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_branch_multiplier_at_branch 
    ON botzilla.branch_multiplier_config(at_branch_id);

CREATE INDEX IF NOT EXISTS idx_branch_multiplier_branch 
    ON botzilla.branch_multiplier_config(branch_id);

CREATE INDEX IF NOT EXISTS idx_branch_multiplier_price_range 
    ON botzilla.branch_multiplier_config(min_cost, max_cost);

CREATE UNIQUE INDEX IF NOT EXISTS idx_branch_multiplier_at_id 
    ON botzilla.branch_multiplier_config(at_multiplier_range_id);

-- Add comments
COMMENT ON TABLE botzilla.branch_multiplier_config IS 'Pricing multiplier ranges from Attic Tech - used to calculate final prices based on true_cost';
COMMENT ON COLUMN botzilla.branch_multiplier_config.at_branch_id IS 'Branch ID in Attic Tech';
COMMENT ON COLUMN botzilla.branch_multiplier_config.branch_id IS 'Branch ID in BotZilla (nullable if not mapped yet)';
COMMENT ON COLUMN botzilla.branch_multiplier_config.name IS 'Range name from Attic Tech (e.g., "LOW $0-$1700")';
COMMENT ON COLUMN botzilla.branch_multiplier_config.min_cost IS 'Minimum price (true_cost) for this range';
COMMENT ON COLUMN botzilla.branch_multiplier_config.max_cost IS 'Maximum price for this range (NULL = no limit)';
COMMENT ON COLUMN botzilla.branch_multiplier_config.lowest_multiple IS 'Lowest multiplier to apply';
COMMENT ON COLUMN botzilla.branch_multiplier_config.highest_multiple IS 'Highest multiplier to apply';
COMMENT ON COLUMN botzilla.branch_multiplier_config.at_multiplier_range_id IS 'Reference to Attic Tech multiplier range ID';

