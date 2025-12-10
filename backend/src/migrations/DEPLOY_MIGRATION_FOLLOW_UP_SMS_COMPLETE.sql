-- ============================================
-- MIGRACIÓN COMPLETA PARA DEPLOY
-- Sistema de Follow-Up + SMS Batches + Chat
-- ============================================
-- Este script consolida TODAS las migraciones necesarias para el deploy
-- de las nuevas funcionalidades de Follow-Up, SMS Batches y Chat en tiempo real.
-- 
-- FECHA: Diciembre 2025
-- VERSIÓN: 1.0
-- ============================================

BEGIN;

-- ============================================
-- PARTE 1: SISTEMA DE FOLLOW-UP (si no existe)
-- ============================================

-- 1.1 Tabla: follow_up_status
CREATE TABLE IF NOT EXISTS botzilla.follow_up_status (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(7), -- Hex color para UI (ej: #FF0000)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar estados iniciales (incluyendo los nuevos)
INSERT INTO botzilla.follow_up_status (name, description, color) VALUES
    ('Lost', 'Customer decided not to proceed', '#EF4444'),
    ('Sold', 'Customer accepted and purchased', '#10B981'),
    ('Negotiating', 'Actively negotiating with customer', '#F59E0B'),
    ('Pending FU', 'Pending follow-up - default status for new tickets', '#6B7280'),
    ('Texted', 'Customer has been texted', '#3B82F6')
ON CONFLICT (name) DO NOTHING;

-- 1.2 Tabla: follow_up_label
CREATE TABLE IF NOT EXISTS botzilla.follow_up_label (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(7), -- Hex color para UI
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar labels iniciales
INSERT INTO botzilla.follow_up_label (name, description, color) VALUES
    ('PMP', 'Price Match Promise follow-up', '#3B82F6'),
    ('Discount', 'Discount offer follow-up', '#8B5CF6'),
    ('Other', 'Other follow-up reasons', '#6B7280')
ON CONFLICT (name) DO NOTHING;

-- 1.3 Tabla: chat
CREATE TABLE IF NOT EXISTS botzilla.chat (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 1.4 Tabla: chat_message
CREATE TABLE IF NOT EXISTS botzilla.chat_message (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER NOT NULL REFERENCES botzilla.chat(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('agent', 'customer', 'system')),
    sender_name VARCHAR(100),
    message_text TEXT NOT NULL,
    metadata JSONB DEFAULT '{}', -- Para attachments, external IDs, etc.
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP, -- Para marcar mensajes como leídos
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para chat_message
CREATE INDEX IF NOT EXISTS idx_chat_message_chat_id ON botzilla.chat_message(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_message_sent_at ON botzilla.chat_message(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_message_sender_type ON botzilla.chat_message(sender_type);
CREATE INDEX IF NOT EXISTS idx_chat_message_read_at ON botzilla.chat_message(read_at) WHERE read_at IS NULL;

-- 1.5 Tabla: follow_up_ticket
CREATE TABLE IF NOT EXISTS botzilla.follow_up_ticket (
    id SERIAL PRIMARY KEY,
    estimate_id INTEGER NOT NULL REFERENCES botzilla.estimate(id) ON DELETE CASCADE,
    followed_up BOOLEAN DEFAULT FALSE,
    status_id INTEGER REFERENCES botzilla.follow_up_status(id),
    label_id INTEGER REFERENCES botzilla.follow_up_label(id),
    chat_id INTEGER REFERENCES botzilla.chat(id) ON DELETE SET NULL,
    notes TEXT, -- Notas internas del equipo
    assigned_to INTEGER REFERENCES botzilla."user"(id), -- Usuario asignado
    follow_up_date DATE, -- Fecha programada para follow-up
    last_contact_date TIMESTAMP, -- Última vez que se contactó al cliente
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para follow_up_ticket
CREATE INDEX IF NOT EXISTS idx_follow_up_ticket_estimate_id ON botzilla.follow_up_ticket(estimate_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_ticket_status_id ON botzilla.follow_up_ticket(status_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_ticket_label_id ON botzilla.follow_up_ticket(label_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_ticket_followed_up ON botzilla.follow_up_ticket(followed_up);
CREATE INDEX IF NOT EXISTS idx_follow_up_ticket_follow_up_date ON botzilla.follow_up_ticket(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_follow_up_ticket_assigned_to ON botzilla.follow_up_ticket(assigned_to);
CREATE INDEX IF NOT EXISTS idx_follow_up_ticket_chat_id ON botzilla.follow_up_ticket(chat_id);

-- ============================================
-- PARTE 2: SISTEMA DE SMS BATCHES
-- ============================================

-- 2.1 Tabla: sms_batch
CREATE TABLE IF NOT EXISTS botzilla.sms_batch (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by INTEGER REFERENCES botzilla."user"(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'draft', -- draft, ready, sent, cancelled
    total_estimates INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}' -- Guarda los filtros aplicados
);

-- 2.2 Tabla: sms_batch_estimate
CREATE TABLE IF NOT EXISTS botzilla.sms_batch_estimate (
    id SERIAL PRIMARY KEY,
    batch_id INTEGER NOT NULL REFERENCES botzilla.sms_batch(id) ON DELETE CASCADE,
    estimate_id INTEGER NOT NULL REFERENCES botzilla.estimate(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, failed, skipped
    sent_at TIMESTAMP,
    error_message TEXT,
    UNIQUE(batch_id, estimate_id)
);

-- Índices para SMS batches
CREATE INDEX IF NOT EXISTS idx_sms_batch_created_by ON botzilla.sms_batch(created_by);
CREATE INDEX IF NOT EXISTS idx_sms_batch_status ON botzilla.sms_batch(status);
CREATE INDEX IF NOT EXISTS idx_sms_batch_created_at ON botzilla.sms_batch(created_at);
CREATE INDEX IF NOT EXISTS idx_sms_batch_estimate_batch_id ON botzilla.sms_batch_estimate(batch_id);
CREATE INDEX IF NOT EXISTS idx_sms_batch_estimate_estimate_id ON botzilla.sms_batch_estimate(estimate_id);
CREATE INDEX IF NOT EXISTS idx_sms_batch_estimate_status ON botzilla.sms_batch_estimate(status);

-- Trigger para actualizar updated_at en sms_batch
CREATE OR REPLACE FUNCTION botzilla.update_sms_batch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_sms_batch_updated_at ON botzilla.sms_batch;
CREATE TRIGGER update_sms_batch_updated_at
    BEFORE UPDATE ON botzilla.sms_batch
    FOR EACH ROW
    EXECUTE FUNCTION botzilla.update_sms_batch_updated_at();

-- Trigger para actualizar total_estimates
CREATE OR REPLACE FUNCTION botzilla.update_sms_batch_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE botzilla.sms_batch 
        SET total_estimates = (
            SELECT COUNT(*) 
            FROM botzilla.sms_batch_estimate 
            WHERE batch_id = NEW.batch_id
        )
        WHERE id = NEW.batch_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE botzilla.sms_batch 
        SET total_estimates = (
            SELECT COUNT(*) 
            FROM botzilla.sms_batch_estimate 
            WHERE batch_id = OLD.batch_id
        )
        WHERE id = OLD.batch_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_sms_batch_count ON botzilla.sms_batch_estimate;
CREATE TRIGGER update_sms_batch_count
    AFTER INSERT OR DELETE ON botzilla.sms_batch_estimate
    FOR EACH ROW
    EXECUTE FUNCTION botzilla.update_sms_batch_count();

-- ============================================
-- PARTE 3: CONFIGURACIÓN DE WEBHOOKS (Opcional)
-- ============================================

-- 3.1 Tabla: sms_webhook_config (opcional, para gestión de múltiples webhooks)
CREATE TABLE IF NOT EXISTS botzilla.sms_webhook_config (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL, -- 'Make.com Production', 'Quo Staging', etc.
    provider VARCHAR(50) NOT NULL, -- 'make_com' o 'quo'
    webhook_url VARCHAR(500) NOT NULL,
    api_key VARCHAR(255), -- Si requiere autenticación
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB DEFAULT '{}' -- Headers adicionales, timeout, etc.
);

-- Índice para búsqueda rápida del webhook activo por defecto
CREATE INDEX IF NOT EXISTS idx_sms_webhook_config_active_default 
    ON botzilla.sms_webhook_config(is_active, is_default) 
    WHERE is_active = true AND is_default = true;

-- ============================================
-- PARTE 4: ACTUALIZACIÓN DE DATOS EXISTENTES
-- ============================================

-- 4.1 Actualizar tickets existentes de "Negotiating" a "Pending FU"
DO $$
DECLARE
    pending_fu_id INTEGER;
    negotiating_id INTEGER;
    updated_count INTEGER;
BEGIN
    -- Obtener IDs
    SELECT id INTO pending_fu_id FROM botzilla.follow_up_status WHERE name = 'Pending FU';
    SELECT id INTO negotiating_id FROM botzilla.follow_up_status WHERE name = 'Negotiating';
    
    -- Verificar que "Pending FU" existe
    IF pending_fu_id IS NULL THEN
        RAISE NOTICE 'Pending FU status not found - skipping update';
    ELSIF negotiating_id IS NOT NULL THEN
        -- Actualizar tickets
        UPDATE botzilla.follow_up_ticket
        SET status_id = pending_fu_id
        WHERE status_id = negotiating_id;
        
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        
        RAISE NOTICE 'Updated % tickets from Negotiating to Pending FU', updated_count;
    ELSE
        RAISE NOTICE 'Negotiating status not found - nothing to update';
    END IF;
END $$;

-- ============================================
-- PARTE 5: VERIFICACIÓN Y COMENTARIOS
-- ============================================

-- Comentarios en las tablas
COMMENT ON TABLE botzilla.follow_up_status IS 'Estados posibles de un follow-up ticket';
COMMENT ON TABLE botzilla.follow_up_label IS 'Etiquetas/categorías de follow-up';
COMMENT ON TABLE botzilla.chat IS 'Contenedor para conversaciones de follow-up';
COMMENT ON TABLE botzilla.chat_message IS 'Mensajes individuales dentro de un chat';
COMMENT ON TABLE botzilla.follow_up_ticket IS 'Ticket principal de follow-up relacionado a un estimate';
COMMENT ON TABLE botzilla.sms_batch IS 'Grupos de estimates para envío masivo de SMS';
COMMENT ON TABLE botzilla.sms_batch_estimate IS 'Relación many-to-many entre batches y estimates';
COMMENT ON TABLE botzilla.sms_webhook_config IS 'Configuración de webhooks para envío de SMS (Make.com, Quo, etc.)';

COMMENT ON COLUMN botzilla.chat_message.metadata IS 'Datos adicionales en formato JSON: attachments, external IDs (WhatsApp, Telegram), read receipts, etc.';
COMMENT ON COLUMN botzilla.chat_message.read_at IS 'Timestamp cuando el mensaje fue leído por el agente';
COMMENT ON COLUMN botzilla.sms_batch.metadata IS 'JSON con filtros aplicados: {priceRange, dateRange, branch, salesperson, etc}';
COMMENT ON COLUMN botzilla.sms_batch.status IS 'draft: en creación, ready: listo para enviar, sent: ya enviado, cancelled: cancelado';

-- Verificar que las tablas se crearon correctamente
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'botzilla'
    AND table_name IN (
        'follow_up_status', 'follow_up_label', 'chat', 'chat_message', 
        'follow_up_ticket', 'sms_batch', 'sms_batch_estimate', 'sms_webhook_config'
    );
    
    IF table_count < 8 THEN
        RAISE WARNING 'Some tables may not have been created. Expected 8, found %', table_count;
    ELSE
        RAISE NOTICE '✅ All 8 tables created successfully';
    END IF;
END $$;

-- Verificar que los statuses se insertaron correctamente
SELECT 
    'Statuses' as check_type,
    COUNT(*) as count,
    string_agg(name, ', ' ORDER BY name) as items
FROM botzilla.follow_up_status
WHERE name IN ('Pending FU', 'Texted', 'Lost', 'Sold', 'Negotiating')
UNION ALL
SELECT 
    'Labels' as check_type,
    COUNT(*) as count,
    string_agg(name, ', ' ORDER BY name) as items
FROM botzilla.follow_up_label
WHERE name IN ('PMP', 'Discount', 'Other');

COMMIT;

-- ============================================
-- FIN DE LA MIGRACIÓN
-- ============================================
-- 
-- PRÓXIMOS PASOS:
-- 1. Verificar que todas las tablas se crearon correctamente
-- 2. Configurar QUO_SMS_WEBHOOK_URL en el .env del backend
-- 3. Verificar que el sistema de WebSockets esté configurado en Nginx
-- 4. Probar el sistema de chat y SMS batches en staging antes de producción
-- 
-- ============================================

