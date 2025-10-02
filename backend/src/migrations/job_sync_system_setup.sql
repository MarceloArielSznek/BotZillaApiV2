-- ============================================================================
-- MIGRATION: Job Sync System Setup
-- Date: 2025-10-02
-- Description: Setup para sistema de sincronización de jobs con Attic Tech
--              y notificaciones a crew leaders y operation managers
-- ============================================================================

-- Set search path
SET search_path TO botzilla;

-- ============================================================================
-- PASO 1: Agregar employee_id a crew_member y sales_person
-- ============================================================================

-- Agregar referencia a employee en crew_member
ALTER TABLE botzilla.crew_member 
ADD COLUMN IF NOT EXISTS employee_id INTEGER REFERENCES botzilla.employee(id);

-- Agregar referencia a employee en sales_person
ALTER TABLE botzilla.sales_person 
ADD COLUMN IF NOT EXISTS employee_id INTEGER REFERENCES botzilla.employee(id);

-- Crear índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_crew_member_employee_id ON botzilla.crew_member(employee_id);
CREATE INDEX IF NOT EXISTS idx_sales_person_employee_id ON botzilla.sales_person(employee_id);

-- ============================================================================
-- PASO 2: Actualizar estados de job_status
-- ============================================================================

-- Eliminar estados anteriores si existen (solo en desarrollo, comentar en producción si hay datos)
-- DELETE FROM botzilla.job_status WHERE name IN ('In Progress', 'Done');

-- Insertar los 9 estados oficiales de Attic Tech
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
-- PASO 3: Crear tabla job_sync (espejo de jobs de Attic Tech)
-- ============================================================================

CREATE TABLE IF NOT EXISTS botzilla.job_sync (
    id SERIAL PRIMARY KEY,
    
    -- Identificador del job en Attic Tech
    attic_tech_job_id INTEGER UNIQUE NOT NULL,
    
    -- Referencias a nuestras tablas
    job_status_id INTEGER REFERENCES botzilla.job_status(id),
    crew_leader_id INTEGER REFERENCES botzilla.crew_member(id),
    sales_person_id INTEGER REFERENCES botzilla.sales_person(id),
    branch_id INTEGER REFERENCES botzilla.branch(id),
    
    -- Información básica del job
    job_name VARCHAR(255),
    estimate_id INTEGER,
    
    -- Control de sincronización
    last_known_status_id INTEGER REFERENCES botzilla.job_status(id),
    last_synced_at TIMESTAMP DEFAULT NOW(),
    
    -- Control de notificaciones
    notification_sent BOOLEAN DEFAULT false,
    last_notification_sent_at TIMESTAMP,
    
    -- Metadata de Attic Tech (JSON para flexibilidad)
    attic_tech_data JSONB,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Crear índices para job_sync
CREATE INDEX IF NOT EXISTS idx_job_sync_attic_tech_job_id ON botzilla.job_sync(attic_tech_job_id);
CREATE INDEX IF NOT EXISTS idx_job_sync_job_status_id ON botzilla.job_sync(job_status_id);
CREATE INDEX IF NOT EXISTS idx_job_sync_crew_leader_id ON botzilla.job_sync(crew_leader_id);
CREATE INDEX IF NOT EXISTS idx_job_sync_sales_person_id ON botzilla.job_sync(sales_person_id);
CREATE INDEX IF NOT EXISTS idx_job_sync_last_synced_at ON botzilla.job_sync(last_synced_at);
CREATE INDEX IF NOT EXISTS idx_job_sync_notification_sent ON botzilla.job_sync(notification_sent);

-- ============================================================================
-- PASO 4: Agregar campos adicionales a tabla job (si son necesarios)
-- ============================================================================

-- Campo para guardar el ID del job en Attic Tech
ALTER TABLE botzilla.job 
ADD COLUMN IF NOT EXISTS attic_tech_job_id INTEGER UNIQUE;

-- Campo para última sincronización
ALTER TABLE botzilla.job 
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP;

-- Crear índice
CREATE INDEX IF NOT EXISTS idx_job_attic_tech_job_id ON botzilla.job(attic_tech_job_id);

-- ============================================================================
-- PASO 5: Crear tabla para log de cambios de estado (auditoría)
-- ============================================================================

CREATE TABLE IF NOT EXISTS botzilla.job_state_change_log (
    id SERIAL PRIMARY KEY,
    
    -- Referencia al job_sync
    job_sync_id INTEGER REFERENCES botzilla.job_sync(id) ON DELETE CASCADE,
    attic_tech_job_id INTEGER NOT NULL,
    
    -- Cambio de estado
    previous_status_id INTEGER REFERENCES botzilla.job_status(id),
    new_status_id INTEGER REFERENCES botzilla.job_status(id),
    
    -- Quién fue notificado
    notified_user_type VARCHAR(50), -- 'crew_leader', 'operation_manager', 'sales_person'
    notified_user_id INTEGER,
    notified_telegram_id VARCHAR(20),
    
    -- Cuándo sucedió
    changed_at TIMESTAMP DEFAULT NOW(),
    
    -- Metadata adicional
    change_metadata JSONB
);

-- Crear índices para auditoría
CREATE INDEX IF NOT EXISTS idx_job_state_log_job_sync_id ON botzilla.job_state_change_log(job_sync_id);
CREATE INDEX IF NOT EXISTS idx_job_state_log_attic_tech_job_id ON botzilla.job_state_change_log(attic_tech_job_id);
CREATE INDEX IF NOT EXISTS idx_job_state_log_changed_at ON botzilla.job_state_change_log(changed_at);

-- ============================================================================
-- PASO 6: Crear vista para facilitar consultas
-- ============================================================================

CREATE OR REPLACE VIEW botzilla.v_job_sync_details AS
SELECT 
    js.id,
    js.attic_tech_job_id,
    js.job_name,
    
    -- Estado actual
    current_status.name AS current_status,
    
    -- Estado anterior
    previous_status.name AS previous_status,
    
    -- Crew Leader info
    cm.name AS crew_leader_name,
    cm.telegram_id AS crew_leader_telegram_id,
    cm.phone AS crew_leader_phone,
    
    -- Sales Person info
    sp.name AS sales_person_name,
    sp.telegram_id AS sales_person_telegram_id,
    
    -- Branch info
    b.name AS branch_name,
    
    -- Sync info
    js.last_synced_at,
    js.notification_sent,
    js.last_notification_sent_at,
    
    -- Timestamps
    js.created_at,
    js.updated_at
FROM botzilla.job_sync js
LEFT JOIN botzilla.job_status current_status ON js.job_status_id = current_status.id
LEFT JOIN botzilla.job_status previous_status ON js.last_known_status_id = previous_status.id
LEFT JOIN botzilla.crew_member cm ON js.crew_leader_id = cm.id
LEFT JOIN botzilla.sales_person sp ON js.sales_person_id = sp.id
LEFT JOIN botzilla.branch b ON js.branch_id = b.id;

-- ============================================================================
-- VERIFICACIÓN: Queries para validar que todo se creó correctamente
-- ============================================================================

-- Verificar que employee_id existe en crew_member
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_schema = 'botzilla' 
--   AND table_name = 'crew_member' 
--   AND column_name = 'employee_id';

-- Verificar que employee_id existe en sales_person
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_schema = 'botzilla' 
--   AND table_name = 'sales_person' 
--   AND column_name = 'employee_id';

-- Verificar estados en job_status
-- SELECT * FROM botzilla.job_status ORDER BY id;

-- Verificar que job_sync fue creada
-- SELECT COUNT(*) FROM botzilla.job_sync;

-- Verificar que job_state_change_log fue creada
-- SELECT COUNT(*) FROM botzilla.job_state_change_log;

-- Verificar la vista
-- SELECT * FROM botzilla.v_job_sync_details LIMIT 1;

-- ============================================================================
-- NOTAS IMPORTANTES PARA PRODUCCIÓN:
-- ============================================================================
-- 1. Hacer backup completo de la BD antes de ejecutar
-- 2. Ejecutar en una transacción para poder hacer rollback si algo falla:
--    BEGIN;
--    -- ejecutar todo el script
--    -- verificar resultados
--    COMMIT; -- o ROLLBACK; si algo salió mal
-- 3. Verificar que no existan datos en las tablas antiguas que se deban migrar
-- 4. Los índices pueden tomar tiempo en tablas grandes, considerar ejecutarlos
--    por separado en horarios de baja actividad
-- ============================================================================

