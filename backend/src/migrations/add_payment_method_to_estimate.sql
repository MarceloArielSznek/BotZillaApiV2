-- Migration: Add payment_method_id to estimate table
-- Description: Links estimates to their payment method, which affects pricing multipliers
-- Author: BotZilla API
-- Date: 2025-11-13

-- Add payment_method_id column to estimate table
ALTER TABLE botzilla.estimate
ADD COLUMN IF NOT EXISTS payment_method_id INTEGER;

-- Add foreign key constraint
ALTER TABLE botzilla.estimate
ADD CONSTRAINT fk_estimate_payment_method
FOREIGN KEY (payment_method_id)
REFERENCES botzilla.payment_method(id)
ON DELETE SET NULL;

-- Create index for faster joins
CREATE INDEX IF NOT EXISTS idx_estimate_payment_method_id ON botzilla.estimate(payment_method_id);

-- Add comment
COMMENT ON COLUMN botzilla.estimate.payment_method_id IS 'Payment method used for this estimate - affects pricing calculations';

