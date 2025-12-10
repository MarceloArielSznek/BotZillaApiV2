-- Migration: Create daily_shift table for New Performance System
-- Date: 2025-11-25

BEGIN;

-- Create daily_shift table
CREATE TABLE IF NOT EXISTS botzilla.daily_shift (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES botzilla.job(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES botzilla.employee(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL,
    regular_hours DECIMAL(10,2) DEFAULT 0.00,
    overtime_hours DECIMAL(10,2) DEFAULT 0.00,
    double_overtime_hours DECIMAL(10,2) DEFAULT 0.00,
    total_hours DECIMAL(10,2) NOT NULL,
    clocked_in_at TIMESTAMP,
    clocked_out_at TIMESTAMP,
    job_gk BIGINT,
    attic_branch_id INTEGER,
    synced_from_attic BOOLEAN DEFAULT true,
    approved BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_daily_shift UNIQUE(job_id, employee_id, shift_date)
);

-- Create indexes
CREATE INDEX idx_daily_shift_job_id ON botzilla.daily_shift(job_id);
CREATE INDEX idx_daily_shift_employee_id ON botzilla.daily_shift(employee_id);
CREATE INDEX idx_daily_shift_date ON botzilla.daily_shift(shift_date);
CREATE INDEX idx_daily_shift_job_gk ON botzilla.daily_shift(job_gk);
CREATE INDEX idx_daily_shift_approved ON botzilla.daily_shift(approved);

-- Add comments
COMMENT ON TABLE botzilla.daily_shift IS 'Daily shifts imported from Attic DB for New Performance System';
COMMENT ON COLUMN botzilla.daily_shift.job_gk IS 'Foreign key to Attic dim_jobsite.job_gk';
COMMENT ON COLUMN botzilla.daily_shift.attic_branch_id IS 'Branch ID from Attic DB';
COMMENT ON COLUMN botzilla.daily_shift.shift_date IS 'Date of the shift (report_date from Attic)';
COMMENT ON COLUMN botzilla.daily_shift.synced_from_attic IS 'Indicates if shift was imported from Attic DB';

COMMIT;

-- Rollback instructions:
-- BEGIN;
-- DROP TABLE IF EXISTS botzilla.daily_shift CASCADE;
-- COMMIT;

