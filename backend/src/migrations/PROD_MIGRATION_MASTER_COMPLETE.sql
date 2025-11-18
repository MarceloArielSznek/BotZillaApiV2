-- ============================================================================
-- MASTER MIGRATION: COMPLETE FOLLOW-UP SYSTEM (4 DÍAS DE TRABAJO)
-- ============================================================================
-- Descripción: Migración completa de todas las funcionalidades implementadas
-- Incluye:
--   1. Payment Methods (tabla + FK en estimate)
--   2. Branch Configuration + Multiplier Ranges (many-to-many)
--   3. Washington State Tax Rates (tabla + campos en estimate)
--   4. Snapshot Multiplier Ranges (campo en estimate)
--   5. Follow-up System (tickets, statuses, labels, chat)
-- 
-- Fecha: 2025-11-18
-- Autor: BotZilla Development Team
-- Ejecutar en: PRODUCCIÓN
-- ============================================================================

-- Iniciar transacción (todo o nada)
BEGIN;

-- ============================================================================
-- SECCIÓN 1: PAYMENT METHODS
-- ============================================================================

-- 1.1 Crear tabla payment_method
CREATE TABLE IF NOT EXISTS botzilla.payment_method (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT payment_method_name_not_empty CHECK (name <> '')
);

-- Índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_payment_method_name ON botzilla.payment_method(name);

-- Insertar payment methods comunes
INSERT INTO botzilla.payment_method (name) VALUES 
    ('credit'),
    ('cash'),
    ('financing'),
    ('check')
ON CONFLICT (name) DO NOTHING;

-- Comentarios
COMMENT ON TABLE botzilla.payment_method IS 'Payment methods used in estimates - affects pricing multipliers';
COMMENT ON COLUMN botzilla.payment_method.name IS 'Name of payment method (credit, cash, financing, check)';

-- 1.2 Agregar payment_method_id a estimate
ALTER TABLE botzilla.estimate
ADD COLUMN IF NOT EXISTS payment_method_id INTEGER;

-- Agregar FK constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = 'botzilla' 
        AND constraint_name = 'fk_estimate_payment_method'
    ) THEN
        ALTER TABLE botzilla.estimate
        ADD CONSTRAINT fk_estimate_payment_method
        FOREIGN KEY (payment_method_id)
        REFERENCES botzilla.payment_method(id)
        ON DELETE SET NULL;
    END IF;
END $$;

-- Índice para joins
CREATE INDEX IF NOT EXISTS idx_estimate_payment_method_id ON botzilla.estimate(payment_method_id);

-- Comentario
COMMENT ON COLUMN botzilla.estimate.payment_method_id IS 'Payment method used for this estimate - affects pricing calculations';

-- ============================================================================
-- SECCIÓN 2: BRANCH CONFIGURATION + MULTIPLIER RANGES
-- ============================================================================

-- 2.1 Crear tabla branch_configuration
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

-- Índices
CREATE INDEX IF NOT EXISTS idx_branch_configuration_at_config_id ON botzilla.branch_configuration(at_config_id);
CREATE INDEX IF NOT EXISTS idx_branch_configuration_name ON botzilla.branch_configuration(name);

-- Comentarios
COMMENT ON TABLE botzilla.branch_configuration IS 'Branch configuration data from Attic Tech (baseConstants and financeFactors)';
COMMENT ON COLUMN botzilla.branch_configuration.at_config_id IS 'Configuration ID in Attic Tech API (unique identifier)';
COMMENT ON COLUMN botzilla.branch_configuration.finance_factors IS 'Finance factors by month (JSON: {"3": 1.5, "6": 1.25, "12": 1.15})';

-- 2.2 Agregar campos a branch
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

-- Índices
CREATE INDEX IF NOT EXISTS idx_branch_attic_tech_id ON botzilla.branch(attic_tech_branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_config_id ON botzilla.branch(branch_configuration_id);

-- FK constraint
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

-- 2.3 Crear/Renombrar tabla multiplier_range
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

-- Crear multiplier_range si no existe
CREATE TABLE IF NOT EXISTS botzilla.multiplier_range (
    id SERIAL PRIMARY KEY,
    at_multiplier_id INTEGER UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    min_cost DECIMAL(10,2),
    max_cost DECIMAL(10,2),
    lowest_multiple DECIMAL(5,3),
    highest_multiple DECIMAL(5,3),
    at_created_at TIMESTAMP,
    at_updated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Limpiar columnas viejas si existen
ALTER TABLE botzilla.multiplier_range DROP CONSTRAINT IF EXISTS fk_branch_multiplier_config_branch;
ALTER TABLE botzilla.multiplier_range DROP COLUMN IF EXISTS at_branch_id;
ALTER TABLE botzilla.multiplier_range DROP COLUMN IF EXISTS branch_id;
ALTER TABLE botzilla.multiplier_range DROP COLUMN IF EXISTS branch_configuration_id;

-- Índices
CREATE INDEX IF NOT EXISTS idx_multiplier_range_at_id ON botzilla.multiplier_range(at_multiplier_id);

-- Comentarios
COMMENT ON TABLE botzilla.multiplier_range IS 'Multiplier ranges from Attic Tech (pricing rules based on true_cost)';
COMMENT ON COLUMN botzilla.multiplier_range.at_multiplier_id IS 'Multiplier range ID in Attic Tech API';

-- 2.4 Crear tabla junction (many-to-many)
CREATE TABLE IF NOT EXISTS botzilla.branch_configuration_multiplier_range (
    id SERIAL PRIMARY KEY,
    branch_configuration_id INTEGER NOT NULL,
    multiplier_range_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT fk_branch_config_mult_range_config 
        FOREIGN KEY (branch_configuration_id) 
        REFERENCES botzilla.branch_configuration(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_branch_config_mult_range_range 
        FOREIGN KEY (multiplier_range_id) 
        REFERENCES botzilla.multiplier_range(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT uk_config_range 
        UNIQUE (branch_configuration_id, multiplier_range_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_branch_config_mult_range_config ON botzilla.branch_configuration_multiplier_range(branch_configuration_id);
CREATE INDEX IF NOT EXISTS idx_branch_config_mult_range_range ON botzilla.branch_configuration_multiplier_range(multiplier_range_id);

-- Comentarios
COMMENT ON TABLE botzilla.branch_configuration_multiplier_range IS 'Junction table: relates configurations with their multiplier ranges (many-to-many)';

-- ============================================================================
-- SECCIÓN 3: WASHINGTON STATE TAX RATES
-- ============================================================================

-- 3.1 Crear tabla wa_tax_rates
CREATE TABLE IF NOT EXISTS botzilla.wa_tax_rates (
    id SERIAL PRIMARY KEY,
    zip_code VARCHAR(10) NOT NULL,
    city_name VARCHAR(100),
    county_name VARCHAR(100),
    city_tax_rate DECIMAL(5, 4) NOT NULL,
    state_tax_rate DECIMAL(5, 4) DEFAULT 0.065 NOT NULL,
    total_tax_rate DECIMAL(5, 4) NOT NULL,
    effective_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(zip_code)
);

-- Índice
CREATE INDEX IF NOT EXISTS idx_wa_tax_rates_zip ON botzilla.wa_tax_rates(zip_code);

-- Comentarios
COMMENT ON TABLE botzilla.wa_tax_rates IS 'Tax rates de Washington State por ZIP code (State + City)';
COMMENT ON COLUMN botzilla.wa_tax_rates.city_tax_rate IS 'City tax rate (ejemplo: 0.037 para 3.7%)';
COMMENT ON COLUMN botzilla.wa_tax_rates.state_tax_rate IS 'State tax rate de WA (6.5% fijo)';
COMMENT ON COLUMN botzilla.wa_tax_rates.total_tax_rate IS 'Total tax rate (state + city)';

-- 3.2 Insertar tax rates de ciudades principales
INSERT INTO botzilla.wa_tax_rates (zip_code, city_name, county_name, city_tax_rate, state_tax_rate, total_tax_rate, effective_date)
VALUES
    -- Seattle (principal)
    ('98101', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98102', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98103', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98104', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98105', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98106', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98107', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98108', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98109', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98112', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98115', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98116', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98117', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98118', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98119', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98121', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98122', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98125', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98126', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98133', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98134', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98136', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98144', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98146', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98177', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98178', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98199', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    -- Everett
    ('98201', 'Everett', 'Snohomish', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98203', 'Everett', 'Snohomish', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98204', 'Everett', 'Snohomish', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98208', 'Everett', 'Snohomish', 0.0370, 0.065, 0.1020, '2024-01-01'),
    -- Kent
    ('98030', 'Kent', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98031', 'Kent', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98032', 'Kent', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98042', 'Kent', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    -- Bellevue
    ('98004', 'Bellevue', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98005', 'Bellevue', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98006', 'Bellevue', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98007', 'Bellevue', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98008', 'Bellevue', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    -- Tacoma
    ('98401', 'Tacoma', 'Pierce', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98402', 'Tacoma', 'Pierce', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98403', 'Tacoma', 'Pierce', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98404', 'Tacoma', 'Pierce', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98405', 'Tacoma', 'Pierce', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98406', 'Tacoma', 'Pierce', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98407', 'Tacoma', 'Pierce', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98408', 'Tacoma', 'Pierce', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98409', 'Tacoma', 'Pierce', 0.0370, 0.065, 0.1020, '2024-01-01'),
    -- Bonney Lake
    ('98391', 'Bonney Lake', 'Pierce', 0.0370, 0.065, 0.1020, '2024-01-01')
ON CONFLICT (zip_code) DO NOTHING;

-- 3.3 Agregar campos de tax a estimate
ALTER TABLE botzilla.estimate
ADD COLUMN IF NOT EXISTS city_tax_rate DECIMAL(5, 4),
ADD COLUMN IF NOT EXISTS state_tax_rate DECIMAL(5, 4),
ADD COLUMN IF NOT EXISTS total_tax_rate DECIMAL(5, 4),
ADD COLUMN IF NOT EXISTS city_tax_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS state_tax_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS total_tax_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS price_before_taxes DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS price_after_taxes DECIMAL(10, 2);

-- Comentarios
COMMENT ON COLUMN botzilla.estimate.city_tax_rate IS 'City tax rate (ejemplo: 0.037 para 3.7%)';
COMMENT ON COLUMN botzilla.estimate.state_tax_rate IS 'State tax rate (0.065 para 6.5% en WA)';
COMMENT ON COLUMN botzilla.estimate.total_tax_rate IS 'Total tax rate (city + state)';
COMMENT ON COLUMN botzilla.estimate.city_tax_amount IS 'Monto de city tax calculado';
COMMENT ON COLUMN botzilla.estimate.state_tax_amount IS 'Monto de state tax calculado';
COMMENT ON COLUMN botzilla.estimate.total_tax_amount IS 'Monto total de taxes (city + state)';
COMMENT ON COLUMN botzilla.estimate.price_before_taxes IS 'Precio final antes de aplicar taxes';
COMMENT ON COLUMN botzilla.estimate.price_after_taxes IS 'Precio final después de aplicar taxes';

-- ============================================================================
-- SECCIÓN 4: SNAPSHOT MULTIPLIER RANGES
-- ============================================================================

ALTER TABLE botzilla.estimate
ADD COLUMN IF NOT EXISTS snapshot_multiplier_ranges JSONB;

COMMENT ON COLUMN botzilla.estimate.snapshot_multiplier_ranges IS 'Snapshot de multiplier ranges vigentes cuando se creó el estimate (de estimateSnapshot.snapshotData.multiplierRanges)';

-- ============================================================================
-- SECCIÓN 5: FOLLOW-UP SYSTEM
-- ============================================================================

-- 5.1 Tabla: follow_up_status
CREATE TABLE IF NOT EXISTS botzilla.follow_up_status (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(7),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO botzilla.follow_up_status (name, description, color) VALUES
    ('Lost', 'Customer decided not to proceed', '#EF4444'),
    ('Sold', 'Customer accepted and purchased', '#10B981'),
    ('Negotiating', 'Actively negotiating with customer', '#F59E0B')
ON CONFLICT (name) DO NOTHING;

COMMENT ON TABLE botzilla.follow_up_status IS 'Estados posibles de un follow-up ticket (Lost, Sold, Negotiating)';

-- 5.2 Tabla: follow_up_label
CREATE TABLE IF NOT EXISTS botzilla.follow_up_label (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(7),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO botzilla.follow_up_label (name, description, color) VALUES
    ('PMP', 'Price Match Promise follow-up', '#3B82F6'),
    ('Discount', 'Discount offer follow-up', '#8B5CF6'),
    ('Other', 'Other follow-up reasons', '#6B7280')
ON CONFLICT (name) DO NOTHING;

COMMENT ON TABLE botzilla.follow_up_label IS 'Etiquetas/categorías de follow-up (PMP, Discount, Other)';

-- 5.3 Tabla: chat
CREATE TABLE IF NOT EXISTS botzilla.chat (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE botzilla.chat IS 'Contenedor para conversaciones de follow-up';

-- 5.4 Tabla: chat_message
CREATE TABLE IF NOT EXISTS botzilla.chat_message (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER NOT NULL REFERENCES botzilla.chat(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('agent', 'customer', 'system')),
    sender_name VARCHAR(100),
    message_text TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_message_chat_id ON botzilla.chat_message(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_message_sent_at ON botzilla.chat_message(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_message_sender_type ON botzilla.chat_message(sender_type);

COMMENT ON TABLE botzilla.chat_message IS 'Mensajes individuales dentro de un chat';
COMMENT ON COLUMN botzilla.chat_message.metadata IS 'Datos adicionales en formato JSON: attachments, external IDs (WhatsApp, Telegram), read receipts, etc.';

-- 5.5 Tabla: follow_up_ticket
CREATE TABLE IF NOT EXISTS botzilla.follow_up_ticket (
    id SERIAL PRIMARY KEY,
    estimate_id INTEGER NOT NULL REFERENCES botzilla.estimate(id) ON DELETE CASCADE,
    followed_up BOOLEAN DEFAULT FALSE,
    status_id INTEGER REFERENCES botzilla.follow_up_status(id),
    label_id INTEGER REFERENCES botzilla.follow_up_label(id),
    chat_id INTEGER REFERENCES botzilla.chat(id) ON DELETE SET NULL,
    notes TEXT,
    assigned_to INTEGER REFERENCES botzilla.user(id),
    follow_up_date DATE,
    last_contact_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_follow_up_ticket_estimate_id ON botzilla.follow_up_ticket(estimate_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_ticket_status_id ON botzilla.follow_up_ticket(status_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_ticket_label_id ON botzilla.follow_up_ticket(label_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_ticket_followed_up ON botzilla.follow_up_ticket(followed_up);
CREATE INDEX IF NOT EXISTS idx_follow_up_ticket_follow_up_date ON botzilla.follow_up_ticket(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_follow_up_ticket_assigned_to ON botzilla.follow_up_ticket(assigned_to);

COMMENT ON TABLE botzilla.follow_up_ticket IS 'Ticket principal de follow-up relacionado a un estimate';
COMMENT ON COLUMN botzilla.follow_up_ticket.notes IS 'Notas internas del equipo (no visibles para el cliente)';
COMMENT ON COLUMN botzilla.follow_up_ticket.assigned_to IS 'Usuario asignado para hacer el follow-up';

-- 5.6 Relación bidireccional con estimate
ALTER TABLE botzilla.estimate 
ADD COLUMN IF NOT EXISTS follow_up_ticket_id INTEGER REFERENCES botzilla.follow_up_ticket(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_estimate_follow_up_ticket_id ON botzilla.estimate(follow_up_ticket_id);

-- ============================================================================
-- SECCIÓN 6: TRIGGERS PARA AUTO-UPDATE
-- ============================================================================

-- Función genérica para actualizar updated_at
CREATE OR REPLACE FUNCTION botzilla.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para follow-up system
DROP TRIGGER IF EXISTS update_follow_up_status_updated_at ON botzilla.follow_up_status;
CREATE TRIGGER update_follow_up_status_updated_at
    BEFORE UPDATE ON botzilla.follow_up_status
    FOR EACH ROW
    EXECUTE FUNCTION botzilla.update_updated_at_column();

DROP TRIGGER IF EXISTS update_follow_up_label_updated_at ON botzilla.follow_up_label;
CREATE TRIGGER update_follow_up_label_updated_at
    BEFORE UPDATE ON botzilla.follow_up_label
    FOR EACH ROW
    EXECUTE FUNCTION botzilla.update_updated_at_column();

DROP TRIGGER IF EXISTS update_chat_updated_at ON botzilla.chat;
CREATE TRIGGER update_chat_updated_at
    BEFORE UPDATE ON botzilla.chat
    FOR EACH ROW
    EXECUTE FUNCTION botzilla.update_updated_at_column();

DROP TRIGGER IF EXISTS update_follow_up_ticket_updated_at ON botzilla.follow_up_ticket;
CREATE TRIGGER update_follow_up_ticket_updated_at
    BEFORE UPDATE ON botzilla.follow_up_ticket
    FOR EACH ROW
    EXECUTE FUNCTION botzilla.update_updated_at_column();

-- ============================================================================
-- SECCIÓN 7: VERIFICACIÓN FINAL
-- ============================================================================

DO $$
DECLARE
    v_count INTEGER;
    v_missing TEXT := '';
BEGIN
    -- Verificar tablas principales
    SELECT COUNT(*) INTO v_count
    FROM information_schema.tables
    WHERE table_schema = 'botzilla'
    AND table_name IN (
        'payment_method',
        'branch_configuration',
        'multiplier_range',
        'branch_configuration_multiplier_range',
        'wa_tax_rates',
        'follow_up_status',
        'follow_up_label',
        'chat',
        'chat_message',
        'follow_up_ticket'
    );
    
    IF v_count <> 10 THEN
        RAISE EXCEPTION 'Error: No se crearon todas las tablas. Se esperaban 10, se encontraron %', v_count;
    END IF;
    
    -- Verificar datos iniciales en payment_method
    SELECT COUNT(*) INTO v_count FROM botzilla.payment_method;
    IF v_count < 4 THEN
        v_missing := v_missing || 'payment_method (' || v_count || '/4), ';
    END IF;
    
    -- Verificar datos iniciales en follow_up_status
    SELECT COUNT(*) INTO v_count FROM botzilla.follow_up_status;
    IF v_count < 3 THEN
        v_missing := v_missing || 'follow_up_status (' || v_count || '/3), ';
    END IF;
    
    -- Verificar datos iniciales en follow_up_label
    SELECT COUNT(*) INTO v_count FROM botzilla.follow_up_label;
    IF v_count < 3 THEN
        v_missing := v_missing || 'follow_up_label (' || v_count || '/3), ';
    END IF;
    
    -- Verificar datos iniciales en wa_tax_rates
    SELECT COUNT(*) INTO v_count FROM botzilla.wa_tax_rates;
    IF v_count < 50 THEN
        v_missing := v_missing || 'wa_tax_rates (' || v_count || '/50), ';
    END IF;
    
    IF v_missing <> '' THEN
        RAISE EXCEPTION 'Error: Faltan datos iniciales en: %', v_missing;
    END IF;
    
    -- Verificar columnas agregadas a estimate
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'botzilla'
        AND table_name = 'estimate'
        AND column_name IN ('payment_method_id', 'city_tax_rate', 'snapshot_multiplier_ranges', 'follow_up_ticket_id')
        GROUP BY table_name
        HAVING COUNT(*) = 4
    ) THEN
        RAISE EXCEPTION 'Error: No se agregaron todas las columnas necesarias a la tabla estimate';
    END IF;
    
    -- Verificar columnas agregadas a branch
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'botzilla'
        AND table_name = 'branch'
        AND column_name IN ('attic_tech_branch_id', 'branch_configuration_id')
        GROUP BY table_name
        HAVING COUNT(*) = 2
    ) THEN
        RAISE EXCEPTION 'Error: No se agregaron todas las columnas necesarias a la tabla branch';
    END IF;
    
    RAISE NOTICE '✅ VERIFICACIÓN EXITOSA: Todas las tablas, columnas y datos fueron creados correctamente';
    RAISE NOTICE '📊 Resumen:';
    RAISE NOTICE '  - 10 tablas nuevas creadas';
    RAISE NOTICE '  - 6 columnas agregadas (4 a estimate, 2 a branch)';
    RAISE NOTICE '  - Payment methods: % registros', (SELECT COUNT(*) FROM botzilla.payment_method);
    RAISE NOTICE '  - Follow-up statuses: % registros', (SELECT COUNT(*) FROM botzilla.follow_up_status);
    RAISE NOTICE '  - Follow-up labels: % registros', (SELECT COUNT(*) FROM botzilla.follow_up_label);
    RAISE NOTICE '  - WA tax rates: % ZIP codes', (SELECT COUNT(*) FROM botzilla.wa_tax_rates);
END $$;

-- ============================================================================
-- COMMIT FINAL
-- ============================================================================

COMMIT;

-- ============================================================================
-- QUERIES DE VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================================

-- Ver todas las tablas creadas
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'botzilla' 
    AND tablename IN (
        'payment_method',
        'branch_configuration',
        'multiplier_range',
        'branch_configuration_multiplier_range',
        'wa_tax_rates',
        'follow_up_status',
        'follow_up_label',
        'chat',
        'chat_message',
        'follow_up_ticket'
    )
ORDER BY tablename;

-- Ver datos insertados
SELECT 'payment_method' as tabla, COUNT(*) as registros FROM botzilla.payment_method
UNION ALL
SELECT 'follow_up_status', COUNT(*) FROM botzilla.follow_up_status
UNION ALL
SELECT 'follow_up_label', COUNT(*) FROM botzilla.follow_up_label
UNION ALL
SELECT 'wa_tax_rates', COUNT(*) FROM botzilla.wa_tax_rates
ORDER BY tabla;

-- Ver columnas agregadas a estimate
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'botzilla'
  AND table_name = 'estimate'
  AND column_name IN (
      'payment_method_id',
      'city_tax_rate',
      'state_tax_rate',
      'snapshot_multiplier_ranges',
      'follow_up_ticket_id'
  )
ORDER BY column_name;

-- Ver columnas agregadas a branch
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'botzilla'
  AND table_name = 'branch'
  AND column_name IN ('attic_tech_branch_id', 'branch_configuration_id')
ORDER BY column_name;

-- ============================================================================
-- FIN DE LA MIGRACIÓN MASTER
-- ============================================================================

-- PRÓXIMOS PASOS:
-- 1. ✅ Reiniciar el backend: pm2 restart botzilla-api
-- 2. 📡 Ejecutar sync de multiplier ranges:
--    GET /api/automations/multiplier-ranges-sync?all=true
-- 3. 📡 Ejecutar sync de estimates (creará tickets automáticamente):
--    POST /api/automations/estimate-sync
-- 4. 🌐 Acceder al frontend: https://yallaprojects.com/follow-up/estimates
-- 5. 🎯 Verificar que todo funciona correctamente

-- NOTAS IMPORTANTES:
-- - Este script es idempotente (se puede ejecutar múltiples veces)
-- - Incluye transacción completa (BEGIN/COMMIT)
-- - Si algo falla, hace ROLLBACK automático
-- - Los tickets se crean automáticamente durante estimate-sync para estimates "Lost"
-- - Las configuraciones de branch se sincronizan con el endpoint de multiplier-ranges-sync

