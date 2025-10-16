-- Fix crew_leader_id foreign key to reference employee table instead of crew_member
-- This allows jobs to be assigned to employees even if they haven't been approved yet

-- 1. Drop existing foreign key constraint
ALTER TABLE botzilla.job
DROP CONSTRAINT IF EXISTS job_crew_leader_id_fkey;

-- 2. Update any invalid crew_leader_id values (pointing to non-existent crew_members)
-- Set them to NULL temporarily
UPDATE botzilla.job
SET crew_leader_id = NULL
WHERE crew_leader_id IS NOT NULL
  AND crew_leader_id NOT IN (SELECT id FROM botzilla.employee);

-- 3. Add new foreign key constraint pointing to employee table
ALTER TABLE botzilla.job
ADD CONSTRAINT job_crew_leader_id_fkey
  FOREIGN KEY (crew_leader_id)
  REFERENCES botzilla.employee(id)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 4. Add index for better performance
CREATE INDEX IF NOT EXISTS idx_job_crew_leader_id ON botzilla.job(crew_leader_id);

COMMENT ON COLUMN botzilla.job.crew_leader_id IS 'References employee.id (not crew_member.id). Allows jobs to be assigned to pending employees.';

