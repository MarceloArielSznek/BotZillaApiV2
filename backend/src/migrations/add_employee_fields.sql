-- Add new fields to employee table for enhanced registration
-- Run this migration to support the updated employee registration form

-- Add address fields (street, city, state, zip)
ALTER TABLE botzilla.employee 
ADD COLUMN street VARCHAR(200);

ALTER TABLE botzilla.employee 
ADD COLUMN city VARCHAR(100);

ALTER TABLE botzilla.employee 
ADD COLUMN state VARCHAR(50);

ALTER TABLE botzilla.employee 
ADD COLUMN zip VARCHAR(20);

-- Add date_of_birth field  
ALTER TABLE botzilla.employee 
ADD COLUMN date_of_birth DATE;

-- Add branch field with location names
ALTER TABLE botzilla.employee 
ADD COLUMN branch VARCHAR(50) CHECK (branch IN ('San Diego', 'Orange County', 'San Bernardino', 'Los Angeles', 'Everett (North Seattle)', 'Kent (South Seattle)'));

-- Add role field with enum constraint
ALTER TABLE botzilla.employee 
ADD COLUMN role VARCHAR(20) CHECK (role IN ('crew_member', 'crew_leader', 'salesperson'));

-- Update existing records to have default values (optional - can be removed if no existing data)
-- UPDATE botzilla.employee SET 
--   street = 'Street not provided',
--   city = 'City not provided',
--   state = 'State not provided',
--   zip = '00000',
--   date_of_birth = '1990-01-01',
--   branch = 'San Diego',
--   role = 'crew_member'
-- WHERE street IS NULL;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_employee_branch ON botzilla.employee(branch);
CREATE INDEX IF NOT EXISTS idx_employee_role ON botzilla.employee(role);
CREATE INDEX IF NOT EXISTS idx_employee_date_of_birth ON botzilla.employee(date_of_birth);
CREATE INDEX IF NOT EXISTS idx_employee_city_state ON botzilla.employee(city, state);

-- Add comments
COMMENT ON COLUMN botzilla.employee.street IS 'Employee street address';
COMMENT ON COLUMN botzilla.employee.city IS 'Employee city';
COMMENT ON COLUMN botzilla.employee.state IS 'Employee state';
COMMENT ON COLUMN botzilla.employee.zip IS 'Employee zip code';
COMMENT ON COLUMN botzilla.employee.date_of_birth IS 'Employee date of birth (must be at least 16 years old)';
COMMENT ON COLUMN botzilla.employee.branch IS 'Branch location where the employee will work';
COMMENT ON COLUMN botzilla.employee.role IS 'Employee role: crew_member, crew_leader, or salesperson';
