-- Migration: Create payment_method table
-- Description: Stores different payment methods used in estimates (credit, cash, financing, etc.)
-- Author: BotZilla API
-- Date: 2025-11-13

-- Create payment_method table
CREATE TABLE IF NOT EXISTS botzilla.payment_method (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT payment_method_name_not_empty CHECK (name <> '')
);

-- Create index on name for faster lookups
CREATE INDEX IF NOT EXISTS idx_payment_method_name ON botzilla.payment_method(name);

-- Insert common payment methods
INSERT INTO botzilla.payment_method (name) VALUES 
    ('credit'),
    ('cash'),
    ('financing'),
    ('check')
ON CONFLICT (name) DO NOTHING;

-- Add comment to table
COMMENT ON TABLE botzilla.payment_method IS 'Payment methods used in estimates - affects pricing multipliers';
COMMENT ON COLUMN botzilla.payment_method.name IS 'Name of payment method (credit, cash, financing, check)';

