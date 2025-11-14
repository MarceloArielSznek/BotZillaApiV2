-- ============================================================================
-- MIGRATION COMPLETA: Branch Configuration + Multiplier Ranges (Many-to-Many)
-- Descripción: Crea estructura completa para configuraciones de branches
-- Fecha: 2025-11-14
-- EJECUTAR EN PRODUCCIÓN
-- ============================================================================

-- ============================================================================
-- PASO 1: Crear tabla branch_configuration
-- ============================================================================

CREATE TABLE IF NOT EXISTS botzilla.branch_configuration (
    id SERIAL PRIMARY KEY,
    
    -- Attic Tech IDs
    at_config_id INTEGER UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    
    -- Base Constants
    base_hourly_rate DECIMAL(10,2),
    average_work_day_hours DECIMAL(5,2),
    waste_factor DECIMAL(5,3),
    credit_card_fee DECIMAL(5,3),
    gas_cost DECIMAL(10,2),
    truck_average_mpg DECIMAL(5,2),
    labor_hours_load_unload DECIMAL(5,2),
    sub_multiplier DECIMAL(5,3),
    cash_factor DECIMAL(5,3),
    max_discount DECIMAL(5,2),
    address TEXT,
    min_retail_price DECIMAL(10,2),
    b2b_max_discount DECIMAL(5,2),
    quality_control_visit_price DECIMAL(10,2),
    bonus_pool_percentage DECIMAL(5,3),
    bonus_payout_cutoff DECIMAL(5,2),
    leaderboard_color_percentage DECIMAL(5,2),
    max_open_estimates INTEGER,
    
    -- Finance Factors (stored as JSONB for flexibility)
    finance_factors JSONB,
    
    -- Timestamps from Attic Tech
    at_created_at TIMESTAMP,
    at_updated_at TIMESTAMP,
    
    -- BotZilla timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para branch_configuration
CREATE INDEX IF NOT EXISTS idx_branch_configuration_at_config_id 
    ON botzilla.branch_configuration(at_config_id);

CREATE INDEX IF NOT EXISTS idx_branch_configuration_name 
    ON botzilla.branch_configuration(name);

-- Comentarios
COMMENT ON TABLE botzilla.branch_configuration IS 'Branch configuration data from Attic Tech (baseConstants and financeFactors)';
COMMENT ON COLUMN botzilla.branch_configuration.at_config_id IS 'Configuration ID in Attic Tech API (unique identifier)';
COMMENT ON COLUMN botzilla.branch_configuration.finance_factors IS 'Finance factors by month (JSON: {"3": 1.5, "6": 1.25, "12": 1.15})';

-- ============================================================================
-- PASO 2: Agregar campos a tabla branch
-- ============================================================================

-- Agregar attic_tech_branch_id si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'botzilla' 
        AND table_name = 'branch' 
        AND column_name = 'attic_tech_branch_id'
    ) THEN
        ALTER TABLE botzilla.branch ADD COLUMN attic_tech_branch_id INTEGER;
        COMMENT ON COLUMN botzilla.branch.attic_tech_branch_id IS 'Branch ID in Attic Tech API (for syncing data)';
    END IF;
END $$;

-- Agregar branch_configuration_id si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'botzilla' 
        AND table_name = 'branch' 
        AND column_name = 'branch_configuration_id'
    ) THEN
        ALTER TABLE botzilla.branch ADD COLUMN branch_configuration_id INTEGER;
        COMMENT ON COLUMN botzilla.branch.branch_configuration_id IS 'FK to branch_configuration table (contains baseConstants and multiplier_ranges)';
    END IF;
END $$;

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_branch_attic_tech_id 
    ON botzilla.branch(attic_tech_branch_id);

CREATE INDEX IF NOT EXISTS idx_branch_config_id 
    ON botzilla.branch(branch_configuration_id);

-- Agregar FK constraint a branch_configuration
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = 'botzilla' 
        AND constraint_name = 'fk_branch_configuration'
    ) THEN
        ALTER TABLE botzilla.branch
            ADD CONSTRAINT fk_branch_configuration 
            FOREIGN KEY (branch_configuration_id) 
            REFERENCES botzilla.branch_configuration(id) 
            ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================================
-- PASO 3: Renombrar y modificar tabla multiplier_range
-- ============================================================================

-- Renombrar tabla si existe branch_multiplier_config
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'botzilla' 
        AND table_name = 'branch_multiplier_config'
    ) THEN
        ALTER TABLE botzilla.branch_multiplier_config RENAME TO multiplier_range;
    END IF;
END $$;

-- Eliminar FK y columnas viejas de multiplier_range
ALTER TABLE botzilla.multiplier_range 
    DROP CONSTRAINT IF EXISTS fk_branch_multiplier_config_branch;

ALTER TABLE botzilla.multiplier_range 
    DROP COLUMN IF EXISTS at_branch_id;

ALTER TABLE botzilla.multiplier_range 
    DROP COLUMN IF EXISTS branch_id;

ALTER TABLE botzilla.multiplier_range 
    DROP COLUMN IF EXISTS branch_configuration_id;

-- ============================================================================
-- PASO 4: Crear tabla junction (many-to-many)
-- ============================================================================

CREATE TABLE IF NOT EXISTS botzilla.branch_configuration_multiplier_range (
    id SERIAL PRIMARY KEY,
    branch_configuration_id INTEGER NOT NULL,
    multiplier_range_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- FKs
    CONSTRAINT fk_branch_config_mult_range_config 
        FOREIGN KEY (branch_configuration_id) 
        REFERENCES botzilla.branch_configuration(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_branch_config_mult_range_range 
        FOREIGN KEY (multiplier_range_id) 
        REFERENCES botzilla.multiplier_range(id) 
        ON DELETE CASCADE,
    
    -- Unique constraint: una configuración no puede tener el mismo range dos veces
    CONSTRAINT uk_config_range 
        UNIQUE (branch_configuration_id, multiplier_range_id)
);

-- Índices para tabla junction
CREATE INDEX IF NOT EXISTS idx_branch_config_mult_range_config 
    ON botzilla.branch_configuration_multiplier_range(branch_configuration_id);

CREATE INDEX IF NOT EXISTS idx_branch_config_mult_range_range 
    ON botzilla.branch_configuration_multiplier_range(multiplier_range_id);

-- Comentarios
COMMENT ON TABLE botzilla.branch_configuration_multiplier_range IS 'Junction table: relates configurations with their multiplier ranges (many-to-many)';
COMMENT ON COLUMN botzilla.branch_configuration_multiplier_range.branch_configuration_id IS 'FK to branch_configuration';
COMMENT ON COLUMN botzilla.branch_configuration_multiplier_range.multiplier_range_id IS 'FK to multiplier_range';

-- ============================================================================
-- PASO 5: Actualizar attic_tech_branch_id existentes (si aplica)
-- ============================================================================

-- Los valores que ya tienes en producción según la imagen:
UPDATE botzilla.branch SET attic_tech_branch_id = 4 WHERE id = 4 AND name = 'San Diego';
UPDATE botzilla.branch SET attic_tech_branch_id = 5 WHERE id = 6 AND name = 'Orange County';
UPDATE botzilla.branch SET attic_tech_branch_id = 3 WHERE id = 7 AND name = 'Everett -WA';
UPDATE botzilla.branch SET attic_tech_branch_id = 1 WHERE id = 8 AND name = 'San Bernardino';
UPDATE botzilla.branch SET attic_tech_branch_id = 2 WHERE id = 9 AND name = 'Kent -WA';
UPDATE botzilla.branch SET attic_tech_branch_id = 8 WHERE id = 16 AND name = 'Los Angeles';

-- ============================================================================
-- ✅ MIGRACIÓN COMPLETA
-- ============================================================================

-- Verificar tablas creadas
SELECT 
    'branch_configuration' as table_name,
    COUNT(*) as row_count
FROM botzilla.branch_configuration
UNION ALL
SELECT 
    'multiplier_range' as table_name,
    COUNT(*) as row_count
FROM botzilla.multiplier_range
UNION ALL
SELECT 
    'branch_configuration_multiplier_range' as table_name,
    COUNT(*) as row_count
FROM botzilla.branch_configuration_multiplier_range
UNION ALL
SELECT 
    'branch (with configs)' as table_name,
    COUNT(*) as row_count
FROM botzilla.branch
WHERE branch_configuration_id IS NOT NULL;

-- ============================================================================
-- NOTAS IMPORTANTES:
-- ============================================================================
-- 1. Este script es IDEMPOTENTE - puedes ejecutarlo múltiples veces sin problemas
-- 2. Usa IF NOT EXISTS para evitar errores si las tablas ya existen
-- 3. Los datos existentes en branch_multiplier_config se preservan al renombrar
-- 4. Después de ejecutar este script, ejecuta el endpoint de sync:
--    GET /api/automations/multiplier-ranges-sync?all=true
-- 5. Esto llenará automáticamente:
--    - branch_configuration (con datos de AT)
--    - branch.branch_configuration_id (FK)
--    - branch_configuration_multiplier_range (relaciones)
-- ============================================================================

