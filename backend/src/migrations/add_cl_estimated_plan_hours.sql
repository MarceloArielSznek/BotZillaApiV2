-- Migración para agregar el campo cl_estimated_plan_hours a la tabla job
-- Ejecutar este SQL en la base de datos

ALTER TABLE botzilla.job 
ADD COLUMN cl_estimated_plan_hours DECIMAL(10, 2) DEFAULT NULL;

-- Comentario para documentar el campo
COMMENT ON COLUMN botzilla.job.cl_estimated_plan_hours IS 'Crew Leader Estimated Plan Hours from spreadsheet - used for planned to save calculation';
