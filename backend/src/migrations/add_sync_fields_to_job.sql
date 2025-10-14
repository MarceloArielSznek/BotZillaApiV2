-- ============================================================================
-- MIGRATION: Add Sync Fields to Job Table
-- Date: 2025-10-02
-- Description: Agregar campos de sincronización con Attic Tech a la tabla job
--              para eliminar la necesidad de job_sync
-- ============================================================================

-- Set search path
SET search_path TO botzilla;

-- ============================================================================
-- PASO 1: Agregar campos de sincronización a tabla job
-- ============================================================================

-- Agregar campos para sincronización con Attic Tech
ALTER TABLE botzilla.job 
ADD COLUMN IF NOT EXISTS attic_tech_job_id INTEGER UNIQUE,
ADD COLUMN IF NOT EXISTS attic_tech_estimate_id INTEGER,
ADD COLUMN IF NOT EXISTS last_known_status_id INTEGER REFERENCES botzilla.job_status(id),
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_notification_sent_at TIMESTAMP;

-- NOTA: sales_person_id NO se agrega aquí porque ya está en estimate
-- Para obtener el sales person: Job → estimate_id → Estimate → sales_person_id → SalesPerson

-- Asegurar que notification_sent existe y tiene default
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'botzilla' 
        AND table_name = 'job' 
        AND column_name = 'notification_sent'
    ) THEN
        ALTER TABLE botzilla.job ADD COLUMN notification_sent BOOLEAN DEFAULT false NOT NULL;
    ELSE
        ALTER TABLE botzilla.job ALTER COLUMN notification_sent SET DEFAULT false;
        ALTER TABLE botzilla.job ALTER COLUMN notification_sent SET NOT NULL;
    END IF;
END $$;

-- ============================================================================
-- PASO 2: Crear índices para mejorar performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_job_attic_tech_job_id ON botzilla.job(attic_tech_job_id);
CREATE INDEX IF NOT EXISTS idx_job_attic_tech_estimate_id ON botzilla.job(attic_tech_estimate_id);
CREATE INDEX IF NOT EXISTS idx_job_last_synced_at ON botzilla.job(last_synced_at);
CREATE INDEX IF NOT EXISTS idx_job_last_known_status_id ON botzilla.job(last_known_status_id);
CREATE INDEX IF NOT EXISTS idx_job_notification_sent ON botzilla.job(notification_sent);

-- ============================================================================
-- PASO 3: Insertar los 9 estados oficiales de Attic Tech (si no existen)
-- ============================================================================

INSERT INTO botzilla.job_status (name) VALUES 
    ('Requires Crew Lead'),
    ('Plans In Progress'),
    ('Pending Review'),
    ('Requires Scheduling'),
    ('Pre-Production'),
    ('In Production'),
    ('Production Complete'),
    ('Pending Payment'),
    ('Closed Job')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- PASO 4: Agregar employee_id a crew_member y sales_person (si no existen)
-- ============================================================================

ALTER TABLE botzilla.crew_member 
ADD COLUMN IF NOT EXISTS employee_id INTEGER REFERENCES botzilla.employee(id);

ALTER TABLE botzilla.sales_person 
ADD COLUMN IF NOT EXISTS employee_id INTEGER REFERENCES botzilla.employee(id);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_crew_member_employee_id ON botzilla.crew_member(employee_id);
CREATE INDEX IF NOT EXISTS idx_sales_person_employee_id ON botzilla.sales_person(employee_id);

-- ============================================================================
-- PASO 5: Eliminar tabla job_sync si existe (ya no es necesaria)
-- ============================================================================

DROP TABLE IF EXISTS botzilla.job_sync CASCADE;
DROP TABLE IF EXISTS botzilla.job_state_change_log CASCADE;

-- ============================================================================
-- VERIFICACIÓN: Queries para validar cambios
-- ============================================================================

-- Verificar nuevas columnas en job
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_schema = 'botzilla' 
--   AND table_name = 'job' 
--   AND column_name IN ('attic_tech_job_id', 'attic_tech_estimate_id', 'last_known_status_id', 'last_synced_at', 'last_notification_sent_at');

-- Verificar índices
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE schemaname = 'botzilla' 
--   AND tablename = 'job' 
--   AND indexname LIKE '%attic%';

-- Verificar estados de job
-- SELECT * FROM botzilla.job_status ORDER BY id;

-- ============================================================================
-- NOTAS PARA PRODUCCIÓN:
-- ============================================================================
-- 1. Hacer backup completo antes de ejecutar
-- 2. Ejecutar en transacción:
--    BEGIN;
--    -- ejecutar script
--    -- verificar resultados
--    COMMIT; -- o ROLLBACK si algo salió mal
-- 3. Si la tabla job_sync tiene datos que quieres migrar a job, hacerlo ANTES del DROP
-- 4. Los índices pueden tardar en tablas grandes
-- ============================================================================

