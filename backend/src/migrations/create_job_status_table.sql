-- Crear tabla job_status
CREATE TABLE IF NOT EXISTS botzilla.job_status (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

-- Insertar los estados iniciales
INSERT INTO botzilla.job_status (name) VALUES 
    ('In Progress'),
    ('Done')
ON CONFLICT (name) DO NOTHING;

-- Agregar columna status_id a la tabla job
ALTER TABLE botzilla.job 
ADD COLUMN IF NOT EXISTS status_id INTEGER REFERENCES botzilla.job_status(id);

-- Establecer 'In Progress' como estado por defecto para jobs existentes
UPDATE botzilla.job 
SET status_id = (SELECT id FROM botzilla.job_status WHERE name = 'In Progress')
WHERE status_id IS NULL;
