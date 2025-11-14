-- Migration: Create branch_configuration table
-- Description: Stores branch configuration data from Attic Tech (baseConstants + financeFactors)
-- Author: BotZilla API
-- Date: 2025-11-14

-- Create branch_configuration table
CREATE TABLE IF NOT EXISTS botzilla.branch_configuration (
    id SERIAL PRIMARY KEY,
    
    -- Attic Tech IDs
    at_config_id INTEGER UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    
    -- Base Constants
    base_hourly_rate DECIMAL(10,2),
    average_work_day_hours DECIMAL(5,2),
    waste_factor DECIMAL(5,3),
    credit_card_fee DECIMAL(5,3),
    gas_cost DECIMAL(10,2),
    truck_average_mpg DECIMAL(5,2),
    labor_hours_load_unload DECIMAL(5,2),
    sub_multiplier DECIMAL(5,3),
    cash_factor DECIMAL(5,3),
    max_discount DECIMAL(5,2),
    address TEXT,
    min_retail_price DECIMAL(10,2),
    b2b_max_discount DECIMAL(5,2),
    quality_control_visit_price DECIMAL(10,2),
    bonus_pool_percentage DECIMAL(5,3),
    bonus_payout_cutoff DECIMAL(5,2),
    leaderboard_color_percentage DECIMAL(5,2),
    max_open_estimates INTEGER,
    
    -- Finance Factors (stored as JSONB for flexibility)
    finance_factors JSONB,
    
    -- Timestamps from Attic Tech
    at_created_at TIMESTAMP,
    at_updated_at TIMESTAMP,
    
    -- BotZilla timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_branch_configuration_at_config_id 
    ON botzilla.branch_configuration(at_config_id);

CREATE INDEX IF NOT EXISTS idx_branch_configuration_name 
    ON botzilla.branch_configuration(name);

-- Add comments
COMMENT ON TABLE botzilla.branch_configuration IS 'Branch configuration data from Attic Tech (baseConstants and financeFactors)';
COMMENT ON COLUMN botzilla.branch_configuration.at_config_id IS 'Configuration ID in Attic Tech API (unique identifier)';
COMMENT ON COLUMN botzilla.branch_configuration.finance_factors IS 'Finance factors by month (JSON: {"3": 1.5, "6": 1.25, "12": 1.15})';

