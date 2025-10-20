-- Migration: Add 'Corporate' branch
-- Date: 2025-10-20
-- Description: Creates the Corporate branch for initial employee registration
--              This branch is used only during registration; real branches are assigned during activation

-- Insert Corporate branch if it doesn't exist
INSERT INTO botzilla.branch (name, address)
SELECT 'Corporate', 'Corporate Office'
WHERE NOT EXISTS (
    SELECT 1 FROM botzilla.branch WHERE name = 'Corporate'
);

-- Verify the branch was created
SELECT id, name, address 
FROM botzilla.branch 
WHERE name = 'Corporate';

